import {
  HybridCrypto,
  HashUtils,
  HybridKeyPair,
  KeyManager,
} from '@h3tag-blockchain/crypto';
import { Logger } from '@h3tag-blockchain/shared/dist/utils/logger';
import { BLOCKCHAIN_CONSTANTS } from '../blockchain/utils/constants';
import crypto from 'crypto';
import { KeystoreDatabase } from '../database/keystore-schema';
import { KeyRotationMetadata } from './keystore-types';
import { promisify } from 'util';
import { scrypt as scryptCallback } from 'crypto';
import { databaseConfig } from '../database/config.database';
import * as bip39 from 'bip39';

const scrypt = promisify(scryptCallback);

export enum KeystoreErrorCode {
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  KDF_ERROR = 'KDF_ERROR',
  INVALID_KEYSTORE_STRUCTURE = 'INVALID_KEYSTORE_STRUCTURE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BACKUP_ERROR = 'BACKUP_ERROR',
  RESTORE_ERROR = 'RESTORE_ERROR',
}

export class KeystoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(`${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} Keystore Error: ${message}`);
    this.name = 'KeystoreError';
  }
}

export interface EncryptedKeystore {
  version: number;
  address: string;
  mnemonic: string;
  crypto: {
    cipher: string;
    ciphertext: string;
    cipherparams: {
      iv: string;
    };
    kdf: string;
    kdfparams: {
      dklen: number;
      n: number;
      r: number;
      p: number;
      salt: string;
    };
    mac: string;
  };
}

export class Keystore {
  private static readonly VERSION = 1;
  private static readonly CIPHER = 'hybrid-aes';
  private static readonly KDF = 'scrypt';
  private static readonly KDF_PARAMS = {
    dklen: 64,
    n: 1048576,
    r: 32,
    p: 4,
  };
  private static readonly MIN_PASSWORD_LENGTH = 12;
  private static readonly MAX_ENCRYPTION_TIME = 5000; // 5 seconds
  private static database: KeystoreDatabase;
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
  private static attempts: Map<string, { count: number; timestamp: number }> =
    new Map();
  private static readonly ROTATION_PERIOD = 90 * 24 * 60 * 60 * 1000; // 90 days
  private static readonly MAX_KEY_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year
  private static rotationMetadata: Map<string, KeyRotationMetadata> = new Map();

  static async initialize(): Promise<void> {
    this.database = new KeystoreDatabase(
      databaseConfig.databases.keystore.path,
    );
  }

  static async encrypt(
    keyPair: HybridKeyPair,
    password: string,
    address: string,
  ): Promise<EncryptedKeystore> {
    try {
      const keystore = await this.encryptKeyPair(keyPair, password, address);
      await this.database.store(address, keystore);
      return keystore;
    } catch (error) {
      Logger.error(
        `${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} keystore encryption failed:`,
        error,
      );
      throw new KeystoreError(
        'Encryption failed',
        error instanceof KeystoreError ? error.code : 'ENCRYPTION_ERROR',
      );
    }
  }

  static async decryptFromAddress(
    address: string,
    password: string,
  ): Promise<HybridKeyPair> {
    try {
      if (!this.database) {
        throw new KeystoreError('Database not initialized', 'DATABASE_ERROR');
      }
      const keystore = await this.database.get(address);
      if (!keystore) {
        throw new KeystoreError('Keystore not found', 'NOT_FOUND');
      }
      return await this.decrypt(keystore, password);
    } catch (error) {
      Logger.error(
        `${BLOCKCHAIN_CONSTANTS.CURRENCY.NAME} keystore decryption failed:`,
        error,
      );
      throw new KeystoreError(
        'Decryption failed',
        error instanceof KeystoreError ? error.code : 'DECRYPTION_ERROR',
      );
    }
  }

  static async decrypt(
    keystore: EncryptedKeystore,
    password: string,
  ): Promise<HybridKeyPair> {
    try {
      const address = keystore.address;
      this.checkRateLimit(address);

      if (!keystore || !password) {
        throw new KeystoreError('Invalid input parameters', 'INVALID_INPUT');
      }

      // Check if key rotation is needed
      if (await this.checkRotationNeeded(address)) {
        Logger.warn(`Key rotation recommended for address: ${address}`);
      }

      const result = await this.decryptKeystore(keystore, password);

      // Reset attempts on success
      this.attempts.delete(address);
      return result;
    } catch (error) {
      this.incrementAttempts(keystore.address);
      throw error;
    }
  }

  private static async encryptKeyPair(
    keyPair: HybridKeyPair,
    password: string,
    address: string,
  ): Promise<EncryptedKeystore> {
    try {
      this.validateInputs(keyPair, password, address);

      const salt = await this.generateSecureSalt();
      const iv = await this.generateSecureIV();
      const derivedKeys = await this.deriveMultipleKeys(
        password,
        salt,
        this.KDF_PARAMS,
      );

      const serializedKeyPair = await this.secureSerialize(keyPair);

      // Use IV in encryption
      const encrypted = await HybridCrypto.encrypt(
        serializedKeyPair + iv.toString('base64'), // Include IV in the message
        derivedKeys.address,
      );

      const mac = await this.calculateEnhancedMAC(derivedKeys, encrypted, salt);

      return {
        version: this.VERSION,
        address,
        mnemonic: bip39.generateMnemonic(256),
        crypto: {
          cipher: this.CIPHER,
          ciphertext: encrypted,
          cipherparams: { iv: iv.toString('base64') },
          kdf: this.KDF,
          kdfparams: {
            ...this.KDF_PARAMS,
            salt: salt.toString('base64'),
          },
          mac,
        },
      };
    } catch (error: unknown) {
      Logger.error(
        'Encryption failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new KeystoreError(
        'Encryption failed',
        error instanceof KeystoreError ? error.code : 'ENCRYPTION_ERROR',
      );
    }
  }

  private static async decryptKeystore(
    keystore: EncryptedKeystore,
    password: string,
  ): Promise<HybridKeyPair> {
    try {
      this.validateKeystore(keystore);
      this.validatePassword(password);

      const derivedKeys = await this.deriveMultipleKeys(
        password,
        Buffer.from(keystore.crypto.kdfparams.salt, 'base64'),
        this.KDF_PARAMS,
      );

      await this.verifyMAC(
        derivedKeys,
        keystore.crypto.ciphertext,
        keystore.crypto.mac,
        keystore.crypto.kdfparams.salt,
      );

      const decrypted = await HybridCrypto.decrypt(
        keystore.crypto.ciphertext,
        derivedKeys.address,
      );

      // Extract IV and actual data from decrypted message
      const iv = Buffer.from(keystore.crypto.cipherparams.iv, 'base64');
      const actualData = decrypted.slice(0, -iv.length);

      return await this.secureDeserialize(actualData);
    } catch (error: unknown) {
      Logger.error(
        'Decryption failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new KeystoreError(
        'Decryption failed',
        error instanceof KeystoreError ? error.code : 'DECRYPTION_ERROR',
      );
    }
  }

  private static async generateSecureSalt(): Promise<Buffer> {
    try {
      const quantumBytes = await HybridCrypto.generateRandomBytes(16);
      const classicalBytes = crypto.randomBytes(16);
      const combinedSalt = Buffer.concat([
        Buffer.from(quantumBytes),
        classicalBytes,
      ]);

      return HashUtils.sha3Buffer(combinedSalt);
    } catch (error) {
      Logger.error(
        'Quantum salt generation failed, falling back to classical:',
        error,
      );
      return crypto.randomBytes(32);
    }
  }

  private static async generateSecureIV(): Promise<Buffer> {
    return crypto.randomBytes(16);
  }

  private static async deriveMultipleKeys(
    password: string,
    salt: Buffer,
    params: typeof Keystore.KDF_PARAMS,
  ): Promise<{ address: string; encryption: string }> {
    try {
      const baseKey = await this.deriveKey(password, salt, params);
      if (!baseKey || baseKey.length < 32) {
        throw new KeystoreError('Invalid derived key', 'KDF_ERROR');
      }
      return {
        address: baseKey,
        encryption: HashUtils.sha3(baseKey),
      };
    } finally {
      this.secureCleanup(password);
      this.secureCleanup(salt);
    }
  }

  private static async deriveKey(
    password: string,
    salt: Buffer,
    params: typeof Keystore.KDF_PARAMS,
  ): Promise<string> {
    try {
      const derivedKey = (await scrypt(password, salt, params.dklen)) as Buffer;

      return derivedKey.toString();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new KeystoreError(
          'Key derivation failed',
          KeystoreErrorCode.KDF_ERROR,
        );
      }
      throw new KeystoreError(
        'Unknown key derivation error',
        KeystoreErrorCode.KDF_ERROR,
      );
    }
  }

  private static async calculateEnhancedMAC(
    keys: { address: string },
    ciphertext: string,
    salt: Buffer,
  ): Promise<string> {
    const combinedData = keys.address + ciphertext + salt.toString('base64');
    return HashUtils.sha3(combinedData);
  }

  private static async verifyMAC(
    keys: { address: string },
    ciphertext: string,
    storedMac: string,
    salt: string,
  ): Promise<void> {
    const calculatedMac = await this.calculateEnhancedMAC(
      keys,
      ciphertext,
      Buffer.from(salt, 'base64'),
    );

    if (
      !crypto.timingSafeEqual(
        Buffer.from(calculatedMac),
        Buffer.from(storedMac),
      )
    ) {
      throw new KeystoreError(
        'Invalid password or corrupted keystore',
        'INVALID_MAC',
      );
    }
  }

  private static validateInputs(
    keyPair: HybridKeyPair,
    password: string,
    address: string,
  ): void {
    this.validatePassword(password);
    if (!address || typeof address !== 'string' || address.length < 1) {
      throw new KeystoreError(
        `Invalid ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} address`,
        'INVALID_ADDRESS',
      );
    }
    if (!keyPair || !keyPair.publicKey || !keyPair.privateKey) {
      throw new KeystoreError(
        `Invalid ${BLOCKCHAIN_CONSTANTS.CURRENCY.SYMBOL} key pair`,
        'INVALID_KEYPAIR',
      );
    }
  }

  private static validatePassword(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new KeystoreError('Invalid password format', 'INVALID_PASSWORD');
    }

    // Use constant-time comparison for length check
    const passwordLength = Buffer.from(password).length;
    if (
      !crypto.timingSafeEqual(
        Buffer.from([passwordLength]),
        Buffer.from([this.MIN_PASSWORD_LENGTH]),
      )
    ) {
      // Use generic error message to avoid length information leakage
      throw new KeystoreError('Invalid password', 'INVALID_PASSWORD');
    }
  }

  private static async secureSerialize(
    keyPair: HybridKeyPair,
  ): Promise<string> {
    try {
      return KeyManager.serializeKeyPair(keyPair);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new KeystoreError('Serialization failed', 'SERIALIZATION_ERROR');
      }
      throw new KeystoreError(
        'Unknown serialization error',
        'SERIALIZATION_ERROR',
      );
    }
  }

  private static async secureDeserialize(data: string): Promise<HybridKeyPair> {
    try {
      return KeyManager.deserializeKeyPair(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new KeystoreError(
          'Deserialization failed',
          'DESERIALIZATION_ERROR',
        );
      }
      throw new KeystoreError(
        'Unknown deserialization error',
        'DESERIALIZATION_ERROR',
      );
    }
  }

  private static validateKeystore(keystore: EncryptedKeystore): void {
    // Basic structure validation
    if (!keystore || typeof keystore !== 'object') {
      throw new KeystoreError(
        'Invalid keystore structure',
        'INVALID_KEYSTORE_STRUCTURE',
      );
    }

    // Version check
    if (
      typeof keystore.version !== 'number' ||
      keystore.version !== this.VERSION
    ) {
      throw new KeystoreError(
        `Unsupported keystore version. Expected ${this.VERSION}`,
        'INVALID_VERSION',
      );
    }

    // Address validation
    if (
      !keystore.address ||
      typeof keystore.address !== 'string' ||
      keystore.address.length < 1
    ) {
      throw new KeystoreError('Invalid address in keystore', 'INVALID_ADDRESS');
    }

    // Crypto section validation
    if (!keystore.crypto || typeof keystore.crypto !== 'object') {
      throw new KeystoreError(
        'Invalid crypto section',
        'INVALID_CRYPTO_SECTION',
      );
    }

    // Cipher validation
    if (keystore.crypto.cipher !== this.CIPHER) {
      throw new KeystoreError(
        `Unsupported cipher. Expected ${this.CIPHER}`,
        'UNSUPPORTED_CIPHER',
      );
    }

    // Ciphertext validation
    if (
      !keystore.crypto.ciphertext ||
      typeof keystore.crypto.ciphertext !== 'string'
    ) {
      throw new KeystoreError('Invalid ciphertext', 'INVALID_CIPHERTEXT');
    }

    // IV validation
    if (
      !keystore.crypto.cipherparams?.iv ||
      typeof keystore.crypto.cipherparams.iv !== 'string' ||
      !this.isValidBase64(keystore.crypto.cipherparams.iv)
    ) {
      throw new KeystoreError('Invalid IV parameter', 'INVALID_IV');
    }

    // KDF validation
    if (keystore.crypto.kdf !== this.KDF) {
      throw new KeystoreError(
        `Unsupported KDF. Expected ${this.KDF}`,
        'UNSUPPORTED_KDF',
      );
    }

    // KDF params validation
    this.validateKDFParams(keystore.crypto.kdfparams, keystore);

    // MAC validation
    if (
      !keystore.crypto.mac ||
      typeof keystore.crypto.mac !== 'string' ||
      !this.isValidBase64(keystore.crypto.mac)
    ) {
      throw new KeystoreError('Invalid MAC', 'INVALID_MAC_FORMAT');
    }
  }

  private static validateKDFParams(
    params: {
      dklen: number;
      n: number;
      r: number;
      p: number;
      salt: string;
    },
    keystore: EncryptedKeystore,
  ): void {
    if (!params || typeof params !== 'object') {
      throw new KeystoreError('Invalid KDF parameters', 'INVALID_KDF_PARAMS');
    }

    const requiredParams = {
      dklen: this.KDF_PARAMS.dklen,
      n: this.KDF_PARAMS.n,
      r: this.KDF_PARAMS.r,
      p: this.KDF_PARAMS.p,
    };

    for (const [key, expectedValue] of Object.entries(requiredParams)) {
      if (
        typeof params[key as keyof typeof params] !== 'number' ||
        params[key as keyof typeof params] !== expectedValue
      ) {
        throw new KeystoreError(
          `Invalid KDF parameter: ${key} for address ${keystore.address}`,
          'INVALID_KDF_PARAM_VALUE',
        );
      }
    }

    if (
      !params.salt ||
      typeof params.salt !== 'string' ||
      !this.isValidBase64(params.salt)
    ) {
      throw new KeystoreError(
        `Invalid salt parameter for address ${keystore.address}`,
        'INVALID_SALT',
      );
    }
  }

  private static isValidBase64(str: string): boolean {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch {
      return false;
    }
  }

  private static secureCleanup(
    sensitiveData: Buffer | string | HybridKeyPair,
  ): void {
    if (Buffer.isBuffer(sensitiveData)) {
      sensitiveData.fill(0);
    } else if (typeof sensitiveData === 'string') {
      const buf = Buffer.from(sensitiveData);
      buf.fill(0);
    } else if (sensitiveData instanceof Object) {
      if ('publicKey' in sensitiveData) {
        sensitiveData.publicKey = '';
      }
      if ('privateKey' in sensitiveData) {
        sensitiveData.privateKey = '';
      }
    }
  }

  private static checkRateLimit(address: string): void {
    const now = Date.now();
    const attempts = this.attempts;
    const attempt = this.attempts.get(address);
    if (!attempt) return;

    if (attempt.count >= this.MAX_ATTEMPTS) {
      const timeLeft = attempt.timestamp + this.LOCKOUT_TIME - now;
      if (timeLeft > 0) {
        throw new KeystoreError(
          `Too many failed attempts. Try again in ${Math.ceil(
            timeLeft / 1000,
          )} seconds`,
          'RATE_LIMIT_EXCEEDED',
        );
      }
      attempts.delete(address);
    }
  }

  private static incrementAttempts(address: string): void {
    const attempt = this.attempts.get(address) || {
      count: 0,
      timestamp: Date.now(),
    };
    attempt.count++;
    attempt.timestamp = Date.now();
    this.attempts.set(address, attempt);
  }

  static async rotateKey(
    address: string,
    password: string,
  ): Promise<EncryptedKeystore> {
    try {
      // Get existing keystore
      if (!this.database) {
        throw new KeystoreError('Database not initialized', 'DATABASE_ERROR');
      }

      const existingKeystore = await this.database.get(address);
      if (!existingKeystore) {
        throw new KeystoreError('Keystore not found', 'NOT_FOUND');
      }

      // Decrypt existing keystore
      const keyPair = await this.decrypt(existingKeystore, password);

      // Generate new key pair while maintaining the address
      let newKeystore: EncryptedKeystore;
      try {
        const newKeyPair = await KeyManager.rotateKeyPair(keyPair);
        newKeystore = await this.encrypt(newKeyPair, password, address);
      } catch (error) {
        await this.secureCleanup(keyPair);
        throw error;
      }

      // Store rotation metadata
      const metadata = this.rotationMetadata.get(address) || {
        lastRotation: Date.now(),
        rotationCount: 0,
        previousKeyHashes: [],
      };

      metadata.previousKeyHashes.push(
        await HashUtils.sha3(JSON.stringify(existingKeystore)),
      );
      metadata.lastRotation = Date.now();
      metadata.rotationCount++;
      this.rotationMetadata.set(address, metadata);

      Logger.info(`Key rotation completed for address: ${address}`);
      await this.database.store(address, newKeystore);
      return newKeystore;
    } catch (error) {
      Logger.error(`Key rotation failed for address: ${address}`, error);
      throw new KeystoreError(
        'Key rotation failed',
        error instanceof KeystoreError ? error.code : 'ROTATION_ERROR',
      );
    }
  }

  static async checkRotationNeeded(address: string): Promise<boolean> {
    try {
      const keystore = await this.database.get(address);
      if (!keystore) {
        throw new KeystoreError('Keystore not found', 'NOT_FOUND');
      }

      const keyAge = Date.now() - keystore.version;
      return keyAge >= this.MAX_KEY_AGE;
    } catch (error) {
      Logger.error('Key rotation check failed:', error);
      return false;
    }
  }

  static getKeyRotationStatus(address: string): KeyRotationMetadata | null {
    return this.rotationMetadata.get(address) || null;
  }

  static async backup(address: string): Promise<string> {
    try {
      if (!this.database) {
        throw new KeystoreError(
          'Database not initialized',
          KeystoreErrorCode.DATABASE_ERROR,
        );
      }

      const keystore = await this.database.get(address);
      if (!keystore) {
        throw new KeystoreError(
          'Keystore not found',
          KeystoreErrorCode.NOT_FOUND,
        );
      }

      const backupData = {
        timestamp: Date.now(),
        keystore,
        metadata: this.rotationMetadata.get(address),
      };

      return JSON.stringify(backupData, null, 2);
    } catch (error) {
      Logger.error(`Backup failed for address: ${address}`, error);
      throw new KeystoreError(
        'Backup failed',
        error instanceof KeystoreError
          ? error.code
          : KeystoreErrorCode.BACKUP_ERROR,
      );
    }
  }

  static async restore(backupData: string, password: string): Promise<string> {
    try {
      const parsed = JSON.parse(backupData);
      const { keystore, metadata } = parsed;

      // Verify the keystore can be decrypted with the password
      await this.decrypt(keystore, password);

      // Store the keystore and metadata
      if (this.database) {
        await this.database.store(keystore.address, keystore);
      }

      if (metadata) {
        this.rotationMetadata.set(keystore.address, metadata);
      }

      return keystore.address;
    } catch (error) {
      Logger.error('Restore failed:', error);
      throw new KeystoreError(
        'Restore failed',
        error instanceof KeystoreError
          ? error.code
          : KeystoreErrorCode.RESTORE_ERROR,
      );
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      if (!this.database) {
        throw new KeystoreError(
          'Database not initialized',
          KeystoreErrorCode.DATABASE_ERROR,
        );
      }

      await this.database.ping();

      const testKey = await this.generateSecureSalt();
      const testData = testKey.toString('hex');
      const encrypted = await HybridCrypto.encrypt(
        testData,
        testKey.toString('base64'),
      );

      // Verify encryption worked by attempting decryption
      const decrypted = await HybridCrypto.decrypt(
        encrypted,
        testKey.toString('base64'),
      );

      return decrypted === testData;
    } catch (error) {
      Logger.error('Keystore health check failed:', error);
      return false;
    }
  }
}
