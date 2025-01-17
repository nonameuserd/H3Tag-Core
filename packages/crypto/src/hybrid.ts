import { Logger } from "@h3tag-blockchain/shared";
import { Dilithium } from "./quantum/dilithium";
import { Kyber } from "./quantum/kyber";
import { HashUtils } from "./hash";
import CryptoJS from "crypto-js";
import { KeyManager } from "./keys";
import { HybridKeyPair } from "./keys";
import { QuantumWrapper } from "./quantum-wrapper";

export class HybridError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HybridError";
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
  static readonly TRADITIONAL_CURVE = require("elliptic").ec("secp256k1");
  private static metrics: HybridMetrics = {
    totalHashes: 0,
    averageTime: 0,
    failedAttempts: 0,
    lastHashTime: 0,
  };

  static async sign(
    message: string,
    privateKey: HybridKeyPair
  ): Promise<{ address: string }> {
    try {
      const privKey =
        typeof privateKey.privateKey === "function"
          ? await privateKey.privateKey()
          : privateKey.privateKey;

      const eccKey = this.TRADITIONAL_CURVE.keyFromPrivate(privKey, "hex");
      const eccSignature = eccKey.sign(HashUtils.sha256(message));

      const [dilithiumHash, kyberSecret] = await Promise.all([
        Dilithium.hash(Buffer.from(message)),
        Kyber.encapsulate(privKey).then((result) => result.sharedSecret),
      ]);

      return {
        address: HashUtils.sha3(
          eccSignature.toDER("hex") + dilithiumHash + kyberSecret
        ),
      };
    } catch (error) {
      Logger.error("Hybrid signing failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Signing failed"
      );
    }
  }

  static async verify(
    message: string,
    signature: { address: string },
    publicKey: { address: string }
  ): Promise<boolean> {
    try {
      // 1. Verify address matches
      if (signature.address !== publicKey.address) return false;

      // 2. Verify traditional signature
      const eccValid = this.TRADITIONAL_CURVE.keyFromPublic(
        publicKey.address,
        "hex"
      ).verify(HashUtils.sha256(message), signature.address);

      if (!eccValid) return false;

      // 3. Generate hybrid verification hash
      const verificationHash = HashUtils.sha3(
        signature.address +
          (await Dilithium.hash(Buffer.from(message))) +
          (await Kyber.encapsulate(publicKey.address)).sharedSecret
      );

      // 4. Compare against message hash
      return verificationHash === HashUtils.sha3(message);
    } catch (error) {
      Logger.error("Hybrid verification failed:", error);
      return false;
    }
  }

  static async encrypt(
    message: string,
    publicKey: { address: string }
  ): Promise<string> {
    try {
      if (!message || !publicKey?.address) {
        throw new HybridError("Missing required parameters");
      }

      // 1. Generate session keys
      const sessionKey = CryptoJS.lib.WordArray.random(this.KEY_SIZE / 8);
      const { ciphertext: kyberCiphertext, sharedSecret: kyberSecret } =
        await Kyber.encapsulate(publicKey.address);

      // 2. Generate quantum-safe components
      const [dilithiumHash, quantumKey] = await Promise.all([
        Dilithium.hash(Buffer.from(message)),
        QuantumWrapper.hashData(Buffer.from(sessionKey.toString())),
      ]);

      // 3. Combine all secrets for encryption
      const hybridKey = HashUtils.sha3(
        sessionKey.toString() +
          kyberSecret +
          dilithiumHash +
          quantumKey.toString("hex")
      );

      // 4. Encrypt with combined key
      const encrypted = CryptoJS.AES.encrypt(message, hybridKey);

      return JSON.stringify({
        data: encrypted.toString(),
        sessionKey: kyberCiphertext,
        quantumProof: dilithiumHash,
      });
    } catch (error) {
      Logger.error("Hybrid encryption failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Encryption failed"
      );
    }
  }

  static async decrypt(
    encryptedData: string,
    privateKey: { address: string }
  ): Promise<string> {
    try {
      if (!encryptedData || !privateKey?.address) {
        throw new HybridError("Missing required parameters");
      }

      const parsed = JSON.parse(encryptedData);
      if (!parsed?.data || !parsed?.sessionKey || !parsed?.quantumProof) {
        throw new HybridError("Invalid encrypted data format");
      }

      // 1. Recover shared secrets
      const kyberSecret = await Kyber.decapsulate(
        parsed.sessionKey,
        privateKey.address
      );
      const quantumKey = await QuantumWrapper.hashData(
        Buffer.from(parsed.sessionKey)
      );

      // 2. Reconstruct hybrid key
      const hybridKey = HashUtils.sha3(
        parsed.sessionKey +
          kyberSecret +
          parsed.quantumProof +
          quantumKey.toString("hex")
      );

      // 3. Decrypt with combined key
      const decrypted = CryptoJS.AES.decrypt(parsed.data, hybridKey);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      Logger.error("Hybrid decryption failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Decryption failed"
      );
    }
  }

  static async generateSharedSecret(input: Buffer): Promise<string> {
    try {
      if (!Buffer.isBuffer(input)) {
        throw new HybridError("Invalid input parameter");
      }

      // Generate quantum shared secret
      const kyberPair = await Kyber.generateKeyPair();
      const { sharedSecret: quantumSecret } = await Kyber.encapsulate(
        kyberPair.publicKey
      );

      // Generate classical shared secret
      const classicalSecret = this.TRADITIONAL_CURVE.genKeyPair().derive(
        this.TRADITIONAL_CURVE.keyFromPublic(
          HashUtils.sha256(input.toString()),
          "hex"
        ).getPublic()
      );

      // Combine secrets
      return HashUtils.sha3(quantumSecret + classicalSecret.toString("hex"));
    } catch (error) {
      Logger.error("Shared secret generation failed:", error);
      throw new HybridError(
        error instanceof Error
          ? error.message
          : "Shared secret generation failed"
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
    privateKey: Buffer
  ): Promise<string> {
    try {
      if (!Buffer.isBuffer(ciphertext) || !Buffer.isBuffer(privateKey)) {
        throw new HybridError("Invalid input parameters");
      }

      const kyberSecret = await Kyber.decapsulate(
        ciphertext.toString("base64"),
        privateKey.toString("base64")
      );

      return HashUtils.sha3(ciphertext.toString("hex") + kyberSecret);
    } catch (error) {
      Logger.error("Shared secret decryption failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Decryption failed"
      );
    }
  }

  public static async combineHashes(
    classicalHash: string,
    quantumHash: string
  ): Promise<string> {
    try {
      return HashUtils.sha3(classicalHash + quantumHash);
    } catch (error) {
      Logger.error("Hash combination failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Hash combination failed"
      );
    }
  }

  public static async verifyClassicalSignature(
    publicKey: string,
    signature: string,
    data: string
  ): Promise<boolean> {
    try {
      const key = this.TRADITIONAL_CURVE.keyFromPublic(publicKey, "hex");
      return key.verify(HashUtils.sha256(data), signature);
    } catch (error) {
      Logger.error("Classical signature verification failed:", error);
      return false;
    }
  }

  public static async verifyQuantumSignature(
    publicKey: string,
    signature: string,
    data: string,
    algorithm?: string
  ): Promise<boolean> {
    try {
      switch (algorithm) {
        case "dilithium":
          return await Dilithium.verify(data, signature, publicKey);
        case "kyber":
          const { ciphertext } = await Kyber.encapsulate(publicKey);
          return ciphertext === signature;
        default:
          return await Dilithium.verify(data, signature, publicKey); // Default to Dilithium
      }
    } catch (error) {
      Logger.error("Quantum signature verification failed:", error);
      return false;
    }
  }

  public static async generateAddress(): Promise<string> {
    try {
      const keyPair = this.TRADITIONAL_CURVE.genKeyPair();
      const publicKey = keyPair.getPublic("hex");
      return HashUtils.sha256(publicKey);
    } catch (error) {
      Logger.error("Address generation failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Address generation failed"
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
        throw new HybridError("INVALID_KEY_DATA");
      }

      const addressStr =
        typeof data.address === "function"
          ? await data.address()
          : data.address;

      // 1. Generate quantum-safe hash
      const quantumHash = await QuantumWrapper.hashData(
        Buffer.from(addressStr)
      );
      const combinedHash = HashUtils.sha3(
        addressStr + quantumHash.toString("hex")
      );

      // 2. Double SHA256 for initial hash
      const hash = HashUtils.doubleSha256(combinedHash);

      // 3. RIPEMD160 of the hash (Bitcoin's approach)
      const ripemd160Hash = HashUtils.hash160(hash);

      // 4. Add version bytes (mainnet + quantum)
      const versionedHash = Buffer.concat([
        Buffer.from([
          0x00, // mainnet version
          0x01, // quantum version
        ]),
        Buffer.from(ripemd160Hash, "hex"),
      ]);

      // 5. Calculate checksum (first 4 bytes of double SHA256)
      const checksum = HashUtils.doubleSha256(
        versionedHash.toString("hex")
      ).slice(0, 8);

      // 6. Combine and encode to base58
      const finalAddress = Buffer.concat([
        versionedHash,
        Buffer.from(checksum, "hex"),
      ]);

      // 7. Validate address format
      const address = HashUtils.toBase58(finalAddress);
      if (!address || address.length < 25 || address.length > 34) {
        throw new HybridError("INVALID_ADDRESS_FORMAT");
      }

      return address;
    } catch (error) {
      Logger.error("Address derivation failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "ADDRESS_GENERATION_FAILED"
      );
    }
  }

  public static async calculateHybridHash(data: any): Promise<string> {
    try {
      const keyPair = await this.generateKeyPair();
      const privateKey =
        typeof keyPair.privateKey === "function"
          ? await keyPair.privateKey()
          : keyPair.privateKey;

      // Generate quantum hash
      const quantumHash = await Dilithium.sign(
        JSON.stringify(data),
        privateKey
      );

      // Generate traditional hash
      const traditionalHash = HashUtils.sha256(JSON.stringify(data));

      // Combine hashes
      return this.deriveAddress({
        address: traditionalHash + quantumHash,
      });
    } catch (error) {
      Logger.error("Hybrid hash calculation failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Hash calculation failed"
      );
    }
  }

  public static async hash(data: string): Promise<string> {
    try {
      // Traditional hash
      const traditionalHash = HashUtils.sha256(data);

      // Generate keypairs first
      const keyPair = await this.generateKeyPair();
      const privateKey =
        typeof keyPair.privateKey === "function"
          ? await keyPair.privateKey()
          : keyPair.privateKey;
      const publicKey =
        typeof keyPair.publicKey === "function"
          ? await keyPair.publicKey()
          : keyPair.publicKey;

      // Generate quantum hashes
      const [dilithiumHash, kyberHash] = await Promise.all([
        Dilithium.sign(data, privateKey),
        Kyber.encapsulate(publicKey).then((result) => result.sharedSecret),
      ]);

      // Combine all hashes
      return HashUtils.sha3(traditionalHash + dilithiumHash + kyberHash);
    } catch (error) {
      Logger.error("Hash generation failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Hash generation failed"
      );
    }
  }

  public static async generateRandomBytes(length: number): Promise<Buffer> {
    try {
      return Buffer.from(
        CryptoJS.lib.WordArray.random(length).toString(),
        "hex"
      );
    } catch (error) {
      Logger.error("Random bytes generation failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Random generation failed"
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
        publicKey: Buffer.from(keyPair.getPublic("hex"), "hex"),
        privateKey: Buffer.from(keyPair.getPrivate("hex"), "hex"),
      };
    } catch (error) {
      Logger.error("Traditional key generation failed:", error);
      throw new HybridError(
        error instanceof Error ? error.message : "Key generation failed"
      );
    }
  }
}
