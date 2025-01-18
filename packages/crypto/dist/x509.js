"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.X509CRL = exports.OCSPResponse = exports.OCSPRequest = void 0;
const asn1_js_1 = require("asn1.js");
const quantum_1 = require("./quantum");
const hybrid_1 = require("./hybrid");
const shared_1 = require("@h3tag-blockchain/shared");
class OCSPRequest {
    constructor({ certificate, issuerCert, nonce, }) {
        this.certificate = certificate;
        this.issuerCert = issuerCert;
        this.nonce = nonce;
    }
    encode() {
        try {
            const tbsRequest = {
                version: 0,
                requestorName: null,
                requestList: [
                    {
                        reqCert: {
                            hashAlgorithm: { algorithm: "2.16.840.1.101.3.4.2.1" },
                            issuerNameHash: this.hashIssuerName(),
                            issuerKeyHash: this.hashIssuerKey(),
                            serialNumber: this.certificate.serialNumber,
                        },
                    },
                ],
                requestExtensions: [
                    {
                        extnID: "1.3.6.1.5.5.7.48.1.2",
                        critical: false,
                        extnValue: this.nonce,
                    },
                ],
            };
            return OCSPRequest.OCSPRequestTemplate.encode(tbsRequest, "der");
        }
        catch (error) {
            shared_1.Logger.error("Failed to encode OCSP request:", error);
            throw error;
        }
    }
    async hashIssuerName() {
        const dilithiumHash = await quantum_1.QuantumCrypto.dilithiumHash(Buffer.from(this.issuerCert.subject));
        const kyberHash = await quantum_1.QuantumCrypto.kyberHash(Buffer.from(this.issuerCert.subject));
        return Buffer.concat([dilithiumHash, kyberHash]);
    }
    async hashIssuerKey() {
        const dilithiumHash = await quantum_1.QuantumCrypto.dilithiumHash(Buffer.from(this.issuerCert.publicKey.export()));
        const kyberHash = await quantum_1.QuantumCrypto.kyberHash(Buffer.from(this.issuerCert.publicKey.export()));
        return Buffer.concat([dilithiumHash, kyberHash]);
    }
}
exports.OCSPRequest = OCSPRequest;
OCSPRequest.OCSPRequestTemplate = asn1_js_1.asn1.define("OCSPRequest", function () {
    this.seq().obj(this.key("tbsRequest")
        .seq()
        .obj(this.key("version").explicit(0).int(), this.key("requestorName").optional().explicit(1), this.key("requestList").seqof(this.key("reqCert")
        .seq()
        .obj(this.key("hashAlgorithm")
        .seq()
        .obj(this.key("algorithm").objid()), this.key("issuerNameHash").octstr(), this.key("issuerKeyHash").octstr(), this.key("serialNumber").int())), this.key("requestExtensions")
        .explicit(2)
        .optional()
        .seqof(this.seq().obj(this.key("extnID").objid(), this.key("critical").bool(), this.key("extnValue").octstr()))));
});
class OCSPResponse {
    constructor(responseData, issuerCert) {
        this.responseData = Buffer.from(responseData);
        this.issuerCert = issuerCert;
        this.parsedResponse = OCSPResponse.OCSPResponseTemplate.decode(this.responseData, "der");
        this.parse();
    }
    parse() {
        try {
            this.responseStatus = this.getResponseStatus(this.parsedResponse.responseStatus);
            if (this.responseStatus === "successful") {
                const responseBytes = this.parsedResponse.responseBytes;
                const basicResponse = OCSPResponse.BasicOCSPResponseTemplate.decode(responseBytes.response, "der");
                this.producedAt = basicResponse.tbsResponseData.producedAt;
                this.thisUpdate = basicResponse.tbsResponseData.responses[0].thisUpdate;
                this.nextUpdate = basicResponse.tbsResponseData.responses[0].nextUpdate;
                this.certStatus = this.getCertStatus(basicResponse.tbsResponseData.responses[0].certStatus);
                if (this.certStatus === "revoked") {
                    this.revocationTime =
                        basicResponse.tbsResponseData.responses[0].certStatus.revocationTime;
                }
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to parse OCSP response:", error);
            throw error;
        }
    }
    async verify() {
        try {
            const signatureAlgorithm = this.parsedResponse.signatureAlgorithm;
            const signature = this.parsedResponse.signature;
            const tbsResponseData = this.parsedResponse.tbsResponseData;
            const classicalValid = await this.verifyClassicalSignature(tbsResponseData, signature, signatureAlgorithm);
            const quantumValid = await this.verifyQuantumSignature(tbsResponseData, signature, signatureAlgorithm);
            return classicalValid && quantumValid;
        }
        catch (error) {
            shared_1.Logger.error("Failed to verify OCSP response:", error);
            return false;
        }
    }
    get status() {
        return this.certStatus;
    }
    get revocationDate() {
        return this.revocationTime;
    }
    getRevocationTime() {
        return this.revocationTime;
    }
    getResponseStatus(status) {
        const statusMap = {
            0: "successful",
            1: "malformedRequest",
            2: "internalError",
            3: "tryLater",
            5: "sigRequired",
            6: "unauthorized",
        };
        return statusMap[status] || "unknown";
    }
    getCertStatus(status) {
        if (status.good !== undefined)
            return "good";
        if (status.revoked !== undefined)
            return "revoked";
        return "unknown";
    }
    async verifyClassicalSignature(tbsResponseData, signature, algorithm) {
        try {
            return await hybrid_1.HybridCrypto.verifyClassicalSignature(this.issuerCert.publicKey.export().toString("hex"), signature.toString("hex"), tbsResponseData.toString("hex"));
        }
        catch (error) {
            shared_1.Logger.error("Classical signature verification failed:", error);
            return false;
        }
    }
    async verifyQuantumSignature(tbsResponseData, signature, algorithm) {
        try {
            return await hybrid_1.HybridCrypto.verifyQuantumSignature(this.issuerCert.publicKey.export().toString("hex"), signature.toString("hex"), tbsResponseData.toString("hex"));
        }
        catch (error) {
            shared_1.Logger.error("Quantum signature verification failed:", error);
            return false;
        }
    }
}
exports.OCSPResponse = OCSPResponse;
OCSPResponse.OCSPResponseTemplate = asn1_js_1.asn1.define("OCSPResponse", function () {
    this.seq().obj(this.key("responseStatus").enum({
        0: "successful",
        1: "malformedRequest",
        2: "internalError",
        3: "tryLater",
        5: "sigRequired",
        6: "unauthorized",
    }), this.key("responseBytes")
        .optional()
        .seq()
        .obj(this.key("responseType").objid(), this.key("response").octstr()));
});
OCSPResponse.BasicOCSPResponseTemplate = asn1_js_1.asn1.define("BasicOCSPResponse", function () {
    this.seq().obj(this.key("tbsResponseData")
        .seq()
        .obj(this.key("version").explicit(0).int(), this.key("responderID").choice({
        byName: this.explicit(1).seq(),
        byKey: this.explicit(2).octstr(),
    }), this.key("producedAt").gentime(), this.key("responses").seqof(this.key("singleResponse")
        .seq()
        .obj(this.key("certID")
        .seq()
        .obj(this.key("hashAlgorithm")
        .seq()
        .obj(this.key("algorithm").objid(), this.key("parameters").optional().null_()), this.key("issuerNameHash").octstr(), this.key("issuerKeyHash").octstr(), this.key("serialNumber").int()), this.key("certStatus").choice({
        good: this.implicit(0).null_(),
        revoked: this.implicit(1)
            .seq()
            .obj(this.key("revocationTime").gentime(), this.key("revocationReason")
            .explicit(0)
            .optional()
            .enum()),
        unknown: this.implicit(2).null_(),
    }), this.key("thisUpdate").gentime(), this.key("nextUpdate").optional().explicit(0).gentime()))), this.key("signatureAlgorithm")
        .seq()
        .obj(this.key("algorithm").objid(), this.key("parameters").optional().null_()), this.key("signature").bitstr(), this.key("certs").optional().explicit(0).seqof(this.key("cert").any()));
});
class X509CRL {
    constructor(crlData) {
        this.crlData = Buffer.from(crlData);
        this.revokedCertificates = new Map();
        this.parse();
    }
    parse() {
        try {
            this.parsedCRL = X509CRL.CRLTemplate.decode(this.crlData, "der");
            this.issuer = this.parsedCRL.tbsCertList.issuer;
            this.lastUpdate = this.parsedCRL.tbsCertList.thisUpdate;
            this.nextUpdate = this.parsedCRL.tbsCertList.nextUpdate;
            // Parse revoked certificates
            if (this.parsedCRL.tbsCertList.revokedCertificates) {
                for (const cert of this.parsedCRL.tbsCertList.revokedCertificates) {
                    this.revokedCertificates.set(cert.serialNumber.toString(), {
                        serialNumber: cert.serialNumber.toString(),
                        revocationDate: cert.revocationDate,
                    });
                }
            }
        }
        catch (error) {
            shared_1.Logger.error("Failed to parse CRL:", error);
            throw error;
        }
    }
    async verify(issuerCert) {
        try {
            const tbsCertList = this.parsedCRL.tbsCertList;
            const signature = this.parsedCRL.signature;
            const signatureAlgorithm = this.parsedCRL.signatureAlgorithm;
            // Verify using hybrid approach (both classical and quantum)
            // Create verification data
            const verificationData = Buffer.concat([
                Buffer.from(tbsCertList),
                Buffer.from(signatureAlgorithm.algorithm),
            ]);
            // Verify using issuer's public key
            return await hybrid_1.HybridCrypto.verifyClassicalSignature(issuerCert.publicKey.export().toString("hex"), signature.toString("hex"), verificationData.toString("hex"));
        }
        catch (error) {
            shared_1.Logger.error("Failed to verify CRL:", error);
            return false;
        }
    }
    getRevokedCertificate(serialNumber) {
        return this.revokedCertificates.get(serialNumber) || null;
    }
    get getNextUpdate() {
        return this.nextUpdate;
    }
}
exports.X509CRL = X509CRL;
X509CRL.CRLTemplate = asn1_js_1.asn1.define("CertificateList", function () {
    this.seq().obj(this.key("tbsCertList")
        .seq()
        .obj(this.key("version").optional().explicit(0).int(), this.key("signature")
        .seq()
        .obj(this.key("algorithm").objid(), this.key("parameters").optional().any()), this.key("issuer").seq(), this.key("thisUpdate").time(), this.key("nextUpdate").optional().time(), this.key("revokedCertificates")
        .optional()
        .seq()
        .obj(this.key("userCertificate").int(), this.key("revocationDate").time(), this.key("crlEntryExtensions").optional().seq())), this.key("signatureAlgorithm")
        .seq()
        .obj(this.key("algorithm").objid(), this.key("parameters").optional().any()), this.key("signature").bitstr());
});
