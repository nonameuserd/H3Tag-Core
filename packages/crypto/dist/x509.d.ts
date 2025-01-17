/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { X509Certificate } from "crypto";
export declare class OCSPRequest {
    private certificate;
    private issuerCert;
    private nonce;
    constructor({ certificate, issuerCert, nonce, }: {
        certificate: X509Certificate;
        issuerCert: X509Certificate;
        nonce: Buffer;
    });
    encode(): Buffer;
    private hashIssuerName;
    private hashIssuerKey;
    private static OCSPRequestTemplate;
}
export declare class OCSPResponse {
    private responseData;
    private parsedResponse;
    private issuerCert;
    private responseStatus;
    private producedAt;
    private thisUpdate;
    private nextUpdate;
    private certStatus;
    private revocationTime?;
    constructor(responseData: ArrayBuffer, issuerCert: X509Certificate);
    private parse;
    verify(): Promise<boolean>;
    get status(): string;
    get revocationDate(): Date | undefined;
    getRevocationTime(): Date | null;
    private getResponseStatus;
    private getCertStatus;
    private static OCSPResponseTemplate;
    private static BasicOCSPResponseTemplate;
    private verifyClassicalSignature;
    private verifyQuantumSignature;
}
export declare class X509CRL {
    private crlData;
    private parsedCRL;
    private issuer;
    private lastUpdate;
    private nextUpdate;
    private revokedCertificates;
    constructor(crlData: ArrayBuffer);
    private parse;
    verify(issuerCert: X509Certificate): Promise<boolean>;
    getRevokedCertificate(serialNumber: string): {
        serialNumber: string;
        revocationDate: Date;
    } | null;
    get getNextUpdate(): Date;
    private static CRLTemplate;
}
