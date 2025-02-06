"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridCrypto = exports.HybridError = void 0;
const shared_1 = require("@h3tag-blockchain/shared");
const dilithium_1 = require("./quantum/dilithium");
const kyber_1 = require("./quantum/kyber");
const hash_1 = require("./hash");
const crypto_js_1 = __importDefault(require("crypto-js"));
const keys_1 = require("./keys");
const quantum_wrapper_1 = require("./quantum-wrapper");
const elliptic_1 = require("elliptic");
class HybridError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HybridError';
    }
}
exports.HybridError = HybridError;
class HybridCrypto {
    /**
     * Signs a given message using a hybrid approach.
     * The ECC signature is generated using the private key,
     * while Dilithium and Kyber operations use the public key.
     * Returns a JSON-encoded string containing each component.
     */
    static async sign(message, keyPair) {
        try {
            const privateKeyVal = typeof keyPair.privateKey === 'function'
                ? await keyPair.privateKey()
                : keyPair.privateKey;
            const publicKeyVal = typeof keyPair.publicKey === 'function'
                ? await keyPair.publicKey()
                : keyPair.publicKey;
            // Generate classical ECC signature using the private key.
            const eccKey = this.TRADITIONAL_CURVE.keyFromPrivate(privateKeyVal, 'hex');
            const eccSignature = eccKey.sign(hash_1.HashUtils.sha256(message)).toDER('hex');
            // Generate quantum components using the public key.
            const [dilithiumSignature, kyberResult] = await Promise.all([
                dilithium_1.Dilithium.hash(Buffer.from(message)),
                kyber_1.Kyber.encapsulate(publicKeyVal),
            ]);
            const kyberSharedSecret = kyberResult.sharedSecret;
            // Build a structured signature object containing each component.
            const signatureObj = {
                ecc: eccSignature,
                dilithium: dilithiumSignature,
                kyber: kyberSharedSecret,
            };
            // Return the signature as a JSON string.
            return JSON.stringify(signatureObj);
        }
        catch (error) {
            shared_1.Logger.error('Hybrid signing failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Signing failed');
        }
    }
    /**
     * Verifies a hybrid signature.
     * It parses the structured JSON signature, then verifies:
     * - The ECC signature using the public key.
     * - The Dilithium quantum signature.
     * - The Kyber component by re-running encapsulation using the public key.
     */
    static async verify(message, signature, publicKey) {
        try {
            // Parse the structured signature.
            let signatureObj;
            try {
                signatureObj = JSON.parse(signature);
            }
            catch (e) {
                shared_1.Logger.error('Hybrid signature parsing failed:', e);
                return false;
            }
            if (!signatureObj.ecc || !signatureObj.dilithium || !signatureObj.kyber) {
                shared_1.Logger.error('Hybrid signature is missing required components.');
                return false;
            }
            // 1. Verify classical ECC signature.
            const eccKey = this.TRADITIONAL_CURVE.keyFromPublic(publicKey, 'hex');
            const eccValid = eccKey.verify(hash_1.HashUtils.sha256(message), signatureObj.ecc);
            if (!eccValid) {
                shared_1.Logger.error('ECC signature verification failed.');
                return false;
            }
            // 2. Verify quantum signature (Dilithium).
            const dilithiumValid = await dilithium_1.Dilithium.verify(message, signatureObj.dilithium, publicKey);
            if (!dilithiumValid) {
                shared_1.Logger.error('Dilithium signature verification failed.');
                return false;
            }
            // 3. Verify quantum component (Kyber).
            // Re-run encapsulation on the public key (assuming deterministic behavior).
            const kyberResult = await kyber_1.Kyber.encapsulate(publicKey);
            if (kyberResult.sharedSecret !== signatureObj.kyber) {
                shared_1.Logger.error('Kyber shared secret mismatch.');
                return false;
            }
            return true;
        }
        catch (error) {
            shared_1.Logger.error('Hybrid verification failed:', error);
            return false;
        }
    }
    static async encrypt(message, publicKey, iv) {
        try {
            if (!message || !publicKey) {
                throw new HybridError('Missing required parameters');
            }
            // 1. Generate session keys.
            const sessionKey = crypto_js_1.default.lib.WordArray.random(this.KEY_SIZE / 8);
            const { ciphertext: kyberCiphertext, sharedSecret: kyberSecret } = await kyber_1.Kyber.encapsulate(publicKey);
            // 2. Generate quantum-safe components.
            const [dilithiumHash, quantumKey] = await Promise.all([
                dilithium_1.Dilithium.hash(Buffer.from(message)),
                quantum_wrapper_1.QuantumWrapper.hashData(Buffer.from(sessionKey.toString())),
            ]);
            // 3. Combine all secrets for encryption.
            const hybridKey = hash_1.HashUtils.sha3(sessionKey.toString() +
                kyberSecret +
                dilithiumHash +
                quantumKey.toString('hex'));
            // 4. Encrypt with combined key using the provided IV (if any).
            const encrypted = iv
                ? crypto_js_1.default.AES.encrypt(message, hybridKey, { iv: crypto_js_1.default.enc.Base64.parse(iv) })
                : crypto_js_1.default.AES.encrypt(message, hybridKey);
            return JSON.stringify({
                data: encrypted.toString(),
                sessionKey: kyberCiphertext,
                quantumProof: dilithiumHash,
            });
        }
        catch (error) {
            shared_1.Logger.error('Hybrid encryption failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Encryption failed');
        }
    }
    static async decrypt(encryptedData, privateKey, iv) {
        try {
            if (!encryptedData || !privateKey) {
                throw new HybridError('Missing required parameters');
            }
            const parsed = JSON.parse(encryptedData);
            if (!parsed?.data || !parsed?.sessionKey || !parsed?.quantumProof) {
                throw new HybridError('Invalid encrypted data format');
            }
            const kyberSecret = await kyber_1.Kyber.decapsulate(parsed.sessionKey, privateKey);
            const quantumKey = await quantum_wrapper_1.QuantumWrapper.hashData(Buffer.from(parsed.sessionKey));
            const hybridKey = hash_1.HashUtils.sha3(parsed.sessionKey +
                kyberSecret +
                parsed.quantumProof +
                quantumKey.toString('hex'));
            // Use the provided IV if available.
            const decrypted = iv
                ? crypto_js_1.default.AES.decrypt(parsed.data, hybridKey, {
                    iv: crypto_js_1.default.enc.Base64.parse(iv)
                })
                : crypto_js_1.default.AES.decrypt(parsed.data, hybridKey);
            return decrypted.toString(crypto_js_1.default.enc.Utf8);
        }
        catch (error) {
            shared_1.Logger.error('Hybrid decryption failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Decryption failed');
        }
    }
    static async generateSharedSecret(input) {
        try {
            if (!Buffer.isBuffer(input)) {
                throw new HybridError('Invalid input parameter');
            }
            // Generate quantum shared secret.
            const kyberPair = await kyber_1.Kyber.generateKeyPair();
            const { sharedSecret: quantumSecret } = await kyber_1.Kyber.encapsulate(kyberPair.publicKey);
            // Generate classical shared secret.
            const classicalSecret = this.TRADITIONAL_CURVE.genKeyPair().derive(this.TRADITIONAL_CURVE.keyFromPublic(hash_1.HashUtils.sha256(input.toString()), 'hex').getPublic());
            // Combine secrets.
            return hash_1.HashUtils.sha3(quantumSecret + classicalSecret.toString('hex'));
        }
        catch (error) {
            shared_1.Logger.error('Shared secret generation failed:', error);
            throw new HybridError(error instanceof Error
                ? error.message
                : 'Shared secret generation failed');
        }
    }
    static getMetrics() {
        return { ...this.metrics };
    }
    static resetMetrics() {
        this.metrics = {
            totalHashes: 0,
            averageTime: 0,
            failedAttempts: 0,
            lastHashTime: 0,
        };
    }
    static async decryptSharedSecret(ciphertext, privateKey) {
        try {
            if (!Buffer.isBuffer(ciphertext) || !Buffer.isBuffer(privateKey)) {
                throw new HybridError('Invalid input parameters');
            }
            const kyberSecret = await kyber_1.Kyber.decapsulate(ciphertext.toString('base64'), privateKey.toString('base64'));
            return hash_1.HashUtils.sha3(ciphertext.toString('hex') + kyberSecret);
        }
        catch (error) {
            shared_1.Logger.error('Shared secret decryption failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Decryption failed');
        }
    }
    static async combineHashes(classicalHash, quantumHash) {
        try {
            return hash_1.HashUtils.sha3(classicalHash + quantumHash);
        }
        catch (error) {
            shared_1.Logger.error('Hash combination failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Hash combination failed');
        }
    }
    static async verifyClassicalSignature(publicKey, signature, data) {
        try {
            const key = this.TRADITIONAL_CURVE.keyFromPublic(publicKey, 'hex');
            return key.verify(hash_1.HashUtils.sha256(data), signature);
        }
        catch (error) {
            shared_1.Logger.error('Classical signature verification failed:', error);
            return false;
        }
    }
    static async verifyQuantumSignature(publicKey, signature, data, algorithm) {
        try {
            switch (algorithm) {
                case 'dilithium':
                    return await dilithium_1.Dilithium.verify(data, signature, publicKey);
                case 'kyber': {
                    const { ciphertext } = await kyber_1.Kyber.encapsulate(publicKey);
                    return ciphertext === signature;
                }
                default:
                    return await dilithium_1.Dilithium.verify(data, signature, publicKey); // Default to Dilithium
            }
        }
        catch (error) {
            shared_1.Logger.error('Quantum signature verification failed:', error);
            return false;
        }
    }
    static async generateAddress() {
        try {
            const keyPair = this.TRADITIONAL_CURVE.genKeyPair();
            const publicKey = keyPair.getPublic('hex');
            return hash_1.HashUtils.sha256(publicKey);
        }
        catch (error) {
            shared_1.Logger.error('Address generation failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Address generation failed');
        }
    }
    static async generateKeyPair(entropy) {
        return await keys_1.KeyManager.generateKeyPair(entropy);
    }
    static async deriveAddress(data) {
        try {
            if (!data?.address) {
                throw new HybridError('INVALID_KEY_DATA');
            }
            const addressStr = typeof data.address === 'function'
                ? await data.address()
                : data.address;
            // 1. Generate quantum-safe hash.
            const quantumHash = await quantum_wrapper_1.QuantumWrapper.hashData(Buffer.from(addressStr));
            const combinedHash = hash_1.HashUtils.sha3(addressStr + quantumHash.toString('hex'));
            // 2. Double SHA256 for initial hash.
            const hash = hash_1.HashUtils.doubleSha256(combinedHash);
            // 3. RIPEMD160 of the hash (Bitcoin's approach).
            const ripemd160Hash = hash_1.HashUtils.hash160(hash);
            // 4. Add version bytes (mainnet + quantum).
            const versionedHash = Buffer.concat([
                Buffer.from([
                    0x00,
                    0x01, // quantum version.
                ]),
                Buffer.from(ripemd160Hash, 'hex'),
            ]);
            // 5. Calculate checksum (first 4 bytes of double SHA256).
            const checksum = hash_1.HashUtils.doubleSha256(versionedHash.toString('hex')).slice(0, 8);
            // 6. Combine and encode to base58.
            const finalAddress = Buffer.concat([
                versionedHash,
                Buffer.from(checksum, 'hex'),
            ]);
            // 7. Validate address format.
            const address = hash_1.HashUtils.toBase58(finalAddress);
            if (!address || address.length < 25 || address.length > 34) {
                throw new HybridError('INVALID_ADDRESS_FORMAT');
            }
            return address;
        }
        catch (error) {
            shared_1.Logger.error('Address derivation failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'ADDRESS_GENERATION_FAILED');
        }
    }
    static async calculateHybridHash(data) {
        try {
            const keyPair = await this.generateKeyPair();
            const privateKey = typeof keyPair.privateKey === 'function'
                ? await keyPair.privateKey()
                : keyPair.privateKey;
            // Generate quantum hash.
            const quantumHash = await dilithium_1.Dilithium.sign(JSON.stringify(data), privateKey);
            // Generate traditional hash.
            const traditionalHash = hash_1.HashUtils.sha256(JSON.stringify(data));
            // Combine hashes.
            return this.deriveAddress({
                address: traditionalHash + quantumHash,
            });
        }
        catch (error) {
            shared_1.Logger.error('Hybrid hash calculation failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Hash calculation failed');
        }
    }
    static async hash(data) {
        try {
            // Traditional hash.
            const traditionalHash = hash_1.HashUtils.sha256(data);
            // Generate keypairs first.
            const keyPair = await this.generateKeyPair();
            const privateKey = typeof keyPair.privateKey === 'function'
                ? await keyPair.privateKey()
                : keyPair.privateKey;
            const publicKey = typeof keyPair.publicKey === 'function'
                ? await keyPair.publicKey()
                : keyPair.publicKey;
            // Generate quantum hashes.
            const [dilithiumHash, kyberHash] = await Promise.all([
                dilithium_1.Dilithium.sign(data, privateKey),
                kyber_1.Kyber.encapsulate(publicKey).then((result) => result.sharedSecret),
            ]);
            // Combine all hashes.
            return hash_1.HashUtils.sha3(traditionalHash + dilithiumHash + kyberHash);
        }
        catch (error) {
            shared_1.Logger.error('Hash generation failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Hash generation failed');
        }
    }
    static async generateRandomBytes(length) {
        try {
            return Buffer.from(crypto_js_1.default.lib.WordArray.random(length).toString(), 'hex');
        }
        catch (error) {
            shared_1.Logger.error('Random bytes generation failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Random generation failed');
        }
    }
    static async generateTraditionalKeys() {
        try {
            const keyPair = this.TRADITIONAL_CURVE.genKeyPair();
            return {
                publicKey: Buffer.from(keyPair.getPublic('hex'), 'hex'),
                privateKey: Buffer.from(keyPair.getPrivate('hex'), 'hex'),
            };
        }
        catch (error) {
            shared_1.Logger.error('Traditional key generation failed:', error);
            throw new HybridError(error instanceof Error ? error.message : 'Key generation failed');
        }
    }
}
exports.HybridCrypto = HybridCrypto;
HybridCrypto.KEY_SIZE = 256;
HybridCrypto.TRADITIONAL_CURVE = new elliptic_1.ec('secp256k1');
HybridCrypto.metrics = {
    totalHashes: 0,
    averageTime: 0,
    failedAttempts: 0,
    lastHashTime: 0,
};
