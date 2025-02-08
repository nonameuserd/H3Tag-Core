import { Logger } from '@h3tag-blockchain/shared';
import { Dilithium } from './quantum/dilithium';
import { Kyber } from './quantum/kyber';
import { HashUtils } from './hash';
import CryptoJS from 'crypto-js';
import { KeyManager } from './keys';
import { HybridKeyPair } from './keys';
import { QuantumWrapper } from './quantum-wrapper';
import { ec as EC } from 'elliptic';

export class HybridError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HybridError';
  }
}

interface HybridMetrics {
  totalHashes: number;
  averageTime: number;
  failedAttempts: number;
  lastHashTime: number;
}

export class HybridCrypto {
  private static readonly KEY_SIZE = 256;
  static readonly TRADITIONAL_CURVE = new EC('secp256k1');
  private static metrics: HybridMetrics = {
    totalHashes: 0,
    averageTime: 0,
    failedAttempts: 0,
    lastHashTime: 0,
  };

  /**
   * Signs a given message using a hybrid approach.
   * The ECC signature is generated using the private key,
   * while Dilithium and Kyber operations use the public key.
   * Returns a JSON-encoded string containing each component.
   */
  static async sign(
    message: string,
    keyPair: HybridKeyPair,
  ): Promise<string> {
    try {
      const privateKeyVal =
        typeof keyPair.privateKey === 'function'
          ? await keyPair.privateKey()
          : keyPair.privateKey;
      const publicKeyVal =
        typeof keyPair.publicKey === 'function'
          ? await keyPair.publicKey()
          : keyPair.publicKey;

      // Generate classical ECC signature using the private key.
      const eccKey = this.TRADITIONAL_CURVE.keyFromPrivate(privateKeyVal, 'hex');
      const eccSignature = eccKey.sign(HashUtils.sha256(message)).toDER('hex');

      // Generate quantum components using the public key.
      const [dilithiumSignature, kyberResult] = await Promise.all([
        Dilithium.hash(Buffer.from(message)),
        Kyber.encapsulate(publicKeyVal),
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
    } catch (error) {
      Logger.error('Hybrid signing failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Signing failed',
      );
    }
  }

  /**
   * Verifies a hybrid signature.
   * It parses the structured JSON signature, then verifies:
   * - The ECC signature using the public key.
   * - The Dilithium quantum signature.
   * - The Kyber component by re-running encapsulation using the public key.
   */
  static async verify(
    message: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    try {
      // Parse the structured signature.
      let signatureObj;
      try {
        signatureObj = JSON.parse(signature);
      } catch (e) {
        Logger.error('Hybrid signature parsing failed:', e);
        return false;
      }

      if (!signatureObj.ecc || !signatureObj.dilithium || !signatureObj.kyber) {
        Logger.error('Hybrid signature is missing required components.');
        return false;
      }

      // 1. Verify classical ECC signature.
      const eccKey = this.TRADITIONAL_CURVE.keyFromPublic(publicKey, 'hex');
      const eccValid = eccKey.verify(HashUtils.sha256(message), signatureObj.ecc);
      if (!eccValid) {
        Logger.error('ECC signature verification failed.');
        return false;
      }

      // 2. Verify quantum signature (Dilithium).
      const dilithiumValid = await Dilithium.verify(message, signatureObj.dilithium, publicKey);
      if (!dilithiumValid) {
        Logger.error('Dilithium signature verification failed.');
        return false;
      }

      // 3. Verify quantum component (Kyber).
      // Re-run encapsulation on the public key (assuming deterministic behavior).
      const kyberResult = await Kyber.encapsulate(publicKey);
      if (kyberResult.sharedSecret !== signatureObj.kyber) {
        Logger.error('Kyber shared secret mismatch.');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Hybrid verification failed:', error);
      return false;
    }
  }

  static async encrypt(message: string, publicKey: string, iv?: string): Promise<string> {
    try {
      if (!message || !publicKey) {
        throw new HybridError('Missing required parameters');
      }

      // 1. Generate session keys.
      const sessionKey = CryptoJS.lib.WordArray.random(this.KEY_SIZE / 8);
      const { ciphertext: kyberCiphertext, sharedSecret: kyberSecret } = await Kyber.encapsulate(publicKey);

      // 2. Generate quantum-safe components.
      const [dilithiumHash, quantumKey] = await Promise.all([
        Dilithium.hash(Buffer.from(message)),
        QuantumWrapper.hashData(Buffer.from(sessionKey.toString())),
      ]);

      // 3. Combine all secrets for encryption.
      const hybridKey = HashUtils.sha3(
        sessionKey.toString() +
        kyberSecret +
        dilithiumHash +
        quantumKey.toString('hex')
      );

      // 4. Encrypt with combined key using the provided IV (if any).
      const encrypted = iv
        ? CryptoJS.AES.encrypt(message, hybridKey, { iv: CryptoJS.enc.Base64.parse(iv) })
        : CryptoJS.AES.encrypt(message, hybridKey);

      return JSON.stringify({
        data: encrypted.toString(),
        sessionKey: kyberCiphertext,
        quantumProof: dilithiumHash,
      });
    } catch (error) {
      Logger.error('Hybrid encryption failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Encryption failed'
      );
    }
  }

  static async decrypt(
    encryptedData: string,
    privateKey: string,
    iv?: string
  ): Promise<string> {
    try {
      if (!encryptedData || !privateKey) {
        throw new HybridError('Missing required parameters');
      }
      
      const parsed = JSON.parse(encryptedData);
      if (!parsed?.data || !parsed?.sessionKey || !parsed?.quantumProof) {
        throw new HybridError('Invalid encrypted data format');
      }
      
      const kyberSecret = await Kyber.decapsulate(parsed.sessionKey, privateKey);
      const quantumKey = await QuantumWrapper.hashData(Buffer.from(parsed.sessionKey));
      
      const hybridKey = HashUtils.sha3(
        parsed.sessionKey +
        kyberSecret +
        parsed.quantumProof +
        quantumKey.toString('hex')
      );
      
      // Use the provided IV if available.
      const decrypted = iv
        ? CryptoJS.AES.decrypt(parsed.data, hybridKey, {
            iv: CryptoJS.enc.Base64.parse(iv)
          })
        : CryptoJS.AES.decrypt(parsed.data, hybridKey);
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      Logger.error('Hybrid decryption failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Decryption failed'
      );
    }
  }

  static async generateSharedSecret(input: Buffer): Promise<string> {
    try {
      if (!Buffer.isBuffer(input)) {
        throw new HybridError('Invalid input parameter');
      }

      // Generate quantum shared secret.
      const kyberPair = await Kyber.generateKeyPair();
      const { sharedSecret: quantumSecret } = await Kyber.encapsulate(
        kyberPair.publicKey,
      );

      // Generate classical shared secret.
      const classicalSecret = this.TRADITIONAL_CURVE.genKeyPair().derive(
        this.TRADITIONAL_CURVE.keyFromPublic(
          HashUtils.sha256(input.toString()),
          'hex',
        ).getPublic(),
      );

      // Combine secrets.
      return HashUtils.sha3(quantumSecret + classicalSecret.toString('hex'));
    } catch (error) {
      Logger.error('Shared secret generation failed:', error);
      throw new HybridError(
        error instanceof Error
          ? error.message
          : 'Shared secret generation failed',
      );
    }
  }

  static getMetrics(): HybridMetrics {
    return { ...this.metrics };
  }

  static resetMetrics(): void {
    this.metrics = {
      totalHashes: 0,
      averageTime: 0,
      failedAttempts: 0,
      lastHashTime: 0,
    };
  }

  static async decryptSharedSecret(
    ciphertext: Buffer,
    privateKey: Buffer,
  ): Promise<string> {
    try {
      if (!Buffer.isBuffer(ciphertext) || !Buffer.isBuffer(privateKey)) {
        throw new HybridError('Invalid input parameters');
      }

      const kyberSecret = await Kyber.decapsulate(
        ciphertext.toString('base64'),
        privateKey.toString('base64'),
      );

      return HashUtils.sha3(ciphertext.toString('hex') + kyberSecret);
    } catch (error) {
      Logger.error('Shared secret decryption failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Decryption failed',
      );
    }
  }

  public static async combineHashes(
    classicalHash: string,
    quantumHash: string,
  ): Promise<string> {
    try {
      return HashUtils.sha3(classicalHash + quantumHash);
    } catch (error) {
      Logger.error('Hash combination failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Hash combination failed',
      );
    }
  }

  public static async verifyClassicalSignature(
    publicKey: string,
    signature: string,
    data: string,
  ): Promise<boolean> {
    try {
      const key = this.TRADITIONAL_CURVE.keyFromPublic(publicKey, 'hex');
      return key.verify(HashUtils.sha256(data), signature);
    } catch (error) {
      Logger.error('Classical signature verification failed:', error);
      return false;
    }
  }

  public static async verifyQuantumSignature(
    publicKey: string,
    signature: string,
    data: string,
    algorithm?: string,
  ): Promise<boolean> {
    try {
      switch (algorithm) {
        case 'dilithium':
          return await Dilithium.verify(data, signature, publicKey);
        case 'kyber': {
          const { ciphertext } = await Kyber.encapsulate(publicKey);
          return ciphertext === signature;
        }
        default:
          return await Dilithium.verify(data, signature, publicKey); // Default to Dilithium
      }
    } catch (error) {
      Logger.error('Quantum signature verification failed:', error);
      return false;
    }
  }

  public static async generateAddress(): Promise<string> {
    try {
      const keyPair = this.TRADITIONAL_CURVE.genKeyPair();
      const publicKey = keyPair.getPublic('hex');
      return HashUtils.sha256(publicKey);
    } catch (error) {
      Logger.error('Address generation failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Address generation failed',
      );
    }
  }

  static async generateKeyPair(entropy?: string): Promise<HybridKeyPair> {
    return await KeyManager.generateKeyPair(entropy);
  }

  public static async deriveAddress(data: {
    address: string | (() => Promise<string>);
  }): Promise<string> {
    try {
      if (!data?.address) {
        throw new HybridError('INVALID_KEY_DATA');
      }

      const addressStr =
        typeof data.address === 'function'
          ? await data.address()
          : data.address;

      // 1. Generate quantum-safe hash.
      const quantumHash = await QuantumWrapper.hashData(
        Buffer.from(addressStr),
      );
      const combinedHash = HashUtils.sha3(
        addressStr + quantumHash.toString('hex'),
      );

      // 2. Double SHA256 for initial hash.
      const hash = HashUtils.doubleSha256(combinedHash);

      // 3. RIPEMD160 of the hash (Bitcoin's approach).
      const ripemd160Hash = HashUtils.hash160(hash);

      // 4. Add version bytes (mainnet + quantum).
      const versionedHash = Buffer.concat([
        Buffer.from([
          0x00, // mainnet version.
          0x01, // quantum version.
        ]),
        Buffer.from(ripemd160Hash, 'hex'),
      ]);

      // 5. Calculate checksum (first 4 bytes of double SHA256).
      const checksum = HashUtils.doubleSha256(
        versionedHash.toString('hex'),
      ).slice(0, 8);

      // 6. Combine and encode to base58.
      const finalAddress = Buffer.concat([
        versionedHash,
        Buffer.from(checksum, 'hex'),
      ]);

      // 7. Validate address format.
      const address = HashUtils.toBase58(finalAddress);
      if (!address || address.length < 25 || address.length > 34) {
        throw new HybridError('INVALID_ADDRESS_FORMAT');
      }

      return address;
    } catch (error) {
      Logger.error('Address derivation failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'ADDRESS_GENERATION_FAILED',
      );
    }
  }

  public static async calculateHybridHash(data: Buffer): Promise<string> {
    try {
      const keyPair = await this.generateKeyPair();
      const privateKey =
        typeof keyPair.privateKey === 'function'
          ? await keyPair.privateKey()
          : keyPair.privateKey;

      // Generate quantum hash.
      const quantumHash = await Dilithium.sign(
        JSON.stringify(data),
        privateKey,
      );

      // Generate traditional hash.
      const traditionalHash = HashUtils.sha256(JSON.stringify(data));

      // Combine hashes.
      return this.deriveAddress({
        address: traditionalHash + quantumHash,
      });
    } catch (error) {
      Logger.error('Hybrid hash calculation failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Hash calculation failed',
      );
    }
  }

  /**
   * Hashes a given string using a hybrid approach.
   * The function generates keypairs first, then hashes the data using:
   * - Dilithium quantum signature
   * - Kyber encapsulation
   * - SHA-256 hash of the data
   *
   * The function returns the SHA-3 hash of the combined hashes.
   *
   * @param data - The string to hash
   * @returns A Promise<string> containing the hybrid hash
   */
  public static async hash(data: string): Promise<string> {
    try {
      // Traditional hash.
      const traditionalHash = HashUtils.sha256(data);

      // Generate keypairs first.
      const keyPair = await this.generateKeyPair();
      const privateKey =
        typeof keyPair.privateKey === 'function'
          ? await keyPair.privateKey()
          : keyPair.privateKey;
      const publicKey =
        typeof keyPair.publicKey === 'function'
          ? await keyPair.publicKey()
          : keyPair.publicKey;

      // Generate quantum hashes.
      const [dilithiumHash, kyberHash] = await Promise.all([
        Dilithium.sign(data, privateKey),
        Kyber.encapsulate(publicKey).then((result) => result.sharedSecret),
      ]);

      // Combine all hashes.
      return HashUtils.sha3(traditionalHash + dilithiumHash + kyberHash);
    } catch (error) {
      Logger.error('Hash generation failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Hash generation failed',
      );
    }
  }

  public static async generateRandomBytes(length: number): Promise<Buffer> {
    try {
      return Buffer.from(
        CryptoJS.lib.WordArray.random(length).toString(),
        'hex',
      );
    } catch (error) {
      Logger.error('Random bytes generation failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Random generation failed',
      );
    }
  }

  public static async generateTraditionalKeys(): Promise<{
    publicKey: Buffer;
    privateKey: Buffer;
  }> {
    try {
      const keyPair = this.TRADITIONAL_CURVE.genKeyPair();
      return {
        publicKey: Buffer.from(keyPair.getPublic('hex'), 'hex'),
        privateKey: Buffer.from(keyPair.getPrivate('hex'), 'hex'),
      };
    } catch (error) {
      Logger.error('Traditional key generation failed:', error);
      throw new HybridError(
        error instanceof Error ? error.message : 'Key generation failed',
      );
    }
  }
}
