import { X509Certificate } from 'crypto';
import { BerReader, BerWriter, Ber } from 'asn1';
import { QuantumCrypto } from './quantum';
import { Logger } from '@h3tag-blockchain/shared';

export class OCSPRequest {
  private certificate: X509Certificate;
  private issuerCert: X509Certificate;
  private nonce: Buffer;

  constructor({
    certificate,
    issuerCert,
    nonce,
  }: {
    certificate: X509Certificate;
    issuerCert: X509Certificate;
    nonce: Buffer;
  }) {
    this.certificate = certificate;
    this.issuerCert = issuerCert;
    this.nonce = nonce;
  }

  public async encode(): Promise<Buffer> {
    try {
      const writer = new BerWriter();

      // Start TBSRequest sequence
      writer.startSequence(Ber.Sequence);

      // Version
      writer.writeInt(0, Ber.Integer);

      // RequestList
      writer.startSequence();
      writer.startSequence(); // CertID

      // Hash Algorithm
      writer.startSequence();
      writer.writeOID('2.16.840.1.101.3.4.2.1', Ber.OID); // SHA-256
      writer.writeNull();
      writer.endSequence();

      // Issuer Name Hash
      const nameHash = await this.hashIssuerName();
      writer.writeBuffer(nameHash, Ber.OctetString);

      // Issuer Key Hash
      const keyHash = await this.hashIssuerKey();
      writer.writeBuffer(keyHash, Ber.OctetString);

      // Serial Number
      writer.writeInt(parseInt(this.certificate.serialNumber), Ber.Integer);

      writer.endSequence(); // End CertID
      writer.endSequence(); // End RequestList

      // Request Extensions
      writer.startSequence(Ber.Context | Ber.Constructor | 2);
      writer.startSequence();
      writer.writeOID('1.3.6.1.5.5.7.48.1.2', Ber.OID); // OCSP Nonce
      writer.writeBoolean(false);
      writer.writeBuffer(this.nonce, Ber.OctetString);
      writer.endSequence();
      writer.endSequence();

      writer.endSequence(); // End TBSRequest

      return writer.buffer;
    } catch (error) {
      Logger.error('Failed to encode OCSP request:', error);
      throw error;
    }
  }

  private async hashIssuerName(): Promise<Buffer> {
    const dilithiumHash = await QuantumCrypto.dilithiumHash(
      Buffer.from(this.issuerCert.subject),
    );
    const kyberHash = await QuantumCrypto.kyberHash(
      Buffer.from(this.issuerCert.subject),
    );
    return Buffer.concat([dilithiumHash, kyberHash]);
  }

  private async hashIssuerKey(): Promise<Buffer> {
    const dilithiumHash = await QuantumCrypto.dilithiumHash(
      Buffer.from(this.issuerCert.publicKey.export()),
    );
    const kyberHash = await QuantumCrypto.kyberHash(
      Buffer.from(this.issuerCert.publicKey.export()),
    );
    return Buffer.concat([dilithiumHash, kyberHash]);
  }
}

export class OCSPResponse {
  private responseData: Buffer;
  private issuerCert: X509Certificate;
  private responseStatus: string | undefined;
  private producedAt: Date | undefined;
  private thisUpdate: Date | undefined;
  private nextUpdate: Date | undefined;
  private certStatus: string | undefined;
  private revocationTime?: Date;

  constructor(responseData: ArrayBuffer, issuerCert: X509Certificate) {
    this.responseData = Buffer.from(responseData);
    this.issuerCert = issuerCert;
    this.parse();
  }

  private parse(): void {
    try {
      const reader = new BerReader(this.responseData);

      reader.readSequence();
      const status = reader.readEnumeration();
      this.responseStatus = this.getResponseStatus(status || 0);

      if (this.responseStatus === 'successful') {
        reader.readSequence();
        const responseBytes = reader.readString(Ber.OctetString);

        if (responseBytes) {
          const basicReader = new BerReader(Buffer.from(responseBytes));
          basicReader.readSequence();

          // Read tbsResponseData
          const tbsReader = new BerReader(
            Buffer.from(basicReader.readString(Ber.OctetString) || ''),
          );
          tbsReader.readSequence();

          // Skip version
          tbsReader.readInt();

          // Read dates
          this.producedAt = new Date(tbsReader.readString() || '');

          // Read single response
          tbsReader.readSequence();
          const certStatus = tbsReader.readByte(true);

          if (certStatus === 0) {
            this.certStatus = 'good';
          } else if (certStatus === 1) {
            this.certStatus = 'revoked';
            this.revocationTime = new Date(tbsReader.readString() || '');
          } else {
            this.certStatus = 'unknown';
          }

          this.thisUpdate = new Date(tbsReader.readString() || '');
          this.nextUpdate = new Date(tbsReader.readString() || '');
        }
      }
    } catch (error) {
      Logger.error('Failed to parse OCSP response:', error);
      throw error;
    }
  }

  private getResponseStatus(status: number): string {
    const statusMap: { [key: number]: string } = {
      0: 'successful',
      1: 'malformedRequest',
      2: 'internalError',
      3: 'tryLater',
      5: 'sigRequired',
      6: 'unauthorized',
    };
    return statusMap[status] || 'unknown';
  }

  public get status(): string {
    return this.certStatus || 'unknown';
  }

  public get revocationDate(): Date | undefined {
    return this.revocationTime;
  }
}

export class X509CRL {
  private crlData: Buffer;
  private issuer: string | undefined;
  private lastUpdate: Date | undefined;
  private nextUpdate: Date | undefined;
  private revokedCertificates: Map<
    string,
    {
      serialNumber: string;
      revocationDate: Date;
    }
  >;

  constructor(crlData: ArrayBuffer) {
    this.crlData = Buffer.from(crlData);
    this.revokedCertificates = new Map();
    this.parse();
  }

  private parse(): void {
    try {
      const reader = new BerReader(this.crlData);

      reader.readSequence();
      reader.readSequence();

      // Skip version
      reader.readInt();

      // Read issuer
      this.issuer = reader.readString() || '';

      // Read dates
      this.lastUpdate = new Date(reader.readString() || '');
      this.nextUpdate = new Date(reader.readString() || '');

      // Read revoked certificates
      reader.readSequence();
      while (reader.remain > 0) {
        reader.readSequence();
        const serialNumber = reader.readString() || '';
        const revocationDate = new Date(reader.readString() || '');

        this.revokedCertificates.set(serialNumber, {
          serialNumber,
          revocationDate,
        });
      }
    } catch (error) {
      Logger.error('Failed to parse CRL:', error);
      throw error;
    }
  }

  public getRevokedCertificate(serialNumber: string): {
    serialNumber: string;
    revocationDate: Date;
  } | null {
    return this.revokedCertificates.get(serialNumber) || null;
  }

  public get getNextUpdate(): Date | undefined {
    return this.nextUpdate;
  }
}
