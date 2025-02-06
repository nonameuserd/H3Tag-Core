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

      // Version (OCSP version is typically 0)
      writer.writeInt(0, Ber.Integer);

      // RequestList
      writer.startSequence();
      writer.startSequence(); // CertID

      // Hash Algorithm – SHA-256 OID
      writer.startSequence();
      writer.writeOID('2.16.840.1.101.3.4.2.1', Ber.OID);
      writer.writeNull();
      writer.endSequence();

      // Issuer Name Hash
      const nameHash = await this.hashIssuerName();
      writer.writeBuffer(nameHash, Ber.OctetString);

      // Issuer Key Hash
      const keyHash = await this.hashIssuerKey();
      writer.writeBuffer(keyHash, Ber.OctetString);

      // Serial Number
      // <-- FIX: using radix 16 since serialNumber is usually a hexadecimal string.
      writer.writeInt(parseInt(this.certificate.serialNumber, 16), Ber.Integer);

      writer.endSequence(); // End CertID
      writer.endSequence(); // End RequestList

      // Request Extensions – using context-specific tag 2
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
    // Note: Converting the subject string may need normalization (if required by your spec)
    const dilithiumHash = await QuantumCrypto.dilithiumHash(
      Buffer.from(this.issuerCert.subject)
    );
    const kyberHash = await QuantumCrypto.kyberHash(
      Buffer.from(this.issuerCert.subject)
    );
    return Buffer.concat([dilithiumHash, kyberHash]);
  }

  private async hashIssuerKey(): Promise<Buffer> {
    // <-- FIX: Export the public key as DER using spki so that the binary data is consistent
    const publicKeyDer = this.issuerCert.publicKey.export({
      type: 'spki',
      format: 'der',
    });
    const dilithiumHash = await QuantumCrypto.dilithiumHash(
      publicKeyDer
    );
    const kyberHash = await QuantumCrypto.kyberHash(
      publicKeyDer
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

  /**
   * Helper method to read an octet string from the BerReader and ensure
   * that we return a Buffer.
   */
  private readOctetStringAsBuffer(reader: BerReader): Buffer {
    const raw = reader.readString(Ber.OctetString);
    if (typeof raw === 'string') {
      return Buffer.from(raw, 'binary');
    } else if (Buffer.isBuffer(raw)) {
      return raw;
    }
    throw new Error('Unable to read octet string as Buffer.');
  }

  private parse(): void {
    try {
      const reader = new BerReader(this.responseData);

      reader.readSequence();
      const status = reader.readEnumeration();
      this.responseStatus = this.getResponseStatus(status || 0);

      if (this.responseStatus === 'successful') {
        reader.readSequence();
        const responseBuffer = this.readOctetStringAsBuffer(reader);

        if (responseBuffer) {
          // Now responseBuffer is guaranteed to be a Buffer.
          const basicReader = new BerReader(responseBuffer);
          basicReader.readSequence();

          // Read tbsResponseData (basic OCSP response)
          const tbsData = basicReader.readString(Ber.OctetString) || '';
          const tbsReader = new BerReader(Buffer.from(tbsData, 'binary'));
          tbsReader.readSequence();

          // Skip version if present
          tbsReader.readInt();

          // Safe parsing for producedAt date
          const producedAtStr = tbsReader.readString();
          if (producedAtStr) {
            this.producedAt = new Date(producedAtStr);
          }

          // Read single response
          tbsReader.readSequence();
          const certStatus = tbsReader.readByte(true);

          if (certStatus === 0) {
            this.certStatus = 'good';
          } else if (certStatus === 1) {
            this.certStatus = 'revoked';
            const revocationStr = tbsReader.readString();
            if (revocationStr) {
              this.revocationTime = new Date(revocationStr);
            }
          } else {
            this.certStatus = 'unknown';
          }

          // Safe parsing for thisUpdate date
          const thisUpdateStr = tbsReader.readString();
          if (thisUpdateStr) {
            this.thisUpdate = new Date(thisUpdateStr);
          }

          // Safe parsing for nextUpdate date (optional field)
          const nextUpdateStr = tbsReader.readString();
          if (nextUpdateStr) {
            this.nextUpdate = new Date(nextUpdateStr);
          }
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

      // Read issuer (note: this may be a complex structure; adjust if you need a parsed DN)
      this.issuer = reader.readString() || '';

      // Read dates with safe parsing
      const lastUpdateStr = reader.readString() || '';
      if (lastUpdateStr) {
        this.lastUpdate = new Date(lastUpdateStr);
      }
      const nextUpdateStr = reader.readString() || '';
      if (nextUpdateStr) {
        this.nextUpdate = new Date(nextUpdateStr);
      }

      // Read revoked certificates sequence
      reader.readSequence();
      while (reader.remain > 0) {
        reader.readSequence();
        const serialNumber = reader.readString() || '';
        const revocationStr = reader.readString() || '';
        let revocationDate: Date;
        if (revocationStr) {
          revocationDate = new Date(revocationStr);
        } else {
          // If revocation date is missing, log an error or skip; here we throw an error.
          throw new Error('Missing revocation date in CRL entry.');
        }

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
