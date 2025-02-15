import { KeyRotationMetadata } from '../../wallet/keystore-types';
import { KeystoreDatabase } from '../../database/keystore-schema';
import { EncryptedKeystore } from '../../wallet/keystore';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tempDir: string;

beforeEach(() => {
  // Create a unique temporary directory for each test
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keystore-db-test-'));
});

afterEach(() => {
  // Clean up the temporary directory after each test
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('KeystoreDatabase', () => {
  test('ping returns true for a healthy database', async () => {
    const db = new KeystoreDatabase(tempDir);
    const result = await db.ping();
    expect(result).toBe(true);
    await db.close();
  });

  test('stores and retrieves an encrypted keystore', async () => {
    const db = new KeystoreDatabase(tempDir);
    const address = 'testAddress';
    const dummyKeystore: EncryptedKeystore = {
      version: 1,
      address: address,
      mnemonic: 'dummy mnemonic',
      createdAt: Date.now(),
      crypto: {
        cipher: 'aes-128-ctr',
        ciphertext: 'dummy ciphertext',
        cipherparams: {
          iv: 'dummy iv'
        },
        kdf: 'scrypt',
        kdfparams: {
          dklen: 32,
          n: 262144,
          p: 1,
          r: 8,
          salt: 'dummy salt'
        },
        mac: 'dummy mac'
      },
    };
    await db.store(address, dummyKeystore);
    const retrieved = await db.get(address);
    expect(retrieved).toEqual(dummyKeystore);
    await db.close();
  });

  test('returns null when keystore is not found', async () => {
    const db = new KeystoreDatabase(tempDir);
    const result = await db.get('nonExistentAddress');
    expect(result).toBeUndefined();
    await db.close();
  });

  test('store method throws error when address is missing', async () => {
    const db = new KeystoreDatabase(tempDir);
    const dummyKeystore: EncryptedKeystore = {
      version: 1,
      address: 'test',
      mnemonic: 'dummy mnemonic',
      createdAt: Date.now(),
      crypto: {
        cipher: 'aes-128-ctr',
        ciphertext: 'dummy ciphertext',
        cipherparams: { iv: 'dummy iv' },
        kdf: 'scrypt',
        kdfparams: {
          dklen: 32,
          n: 262144,
          p: 1,
          r: 8,
          salt: 'dummy salt'
        },
        mac: 'dummy mac'
      }
    };
    await expect(db.store('', dummyKeystore)).rejects.toThrow('Address is required');
    await db.close();
  });

  test('store method throws error when keystore is missing', async () => {
    const db = new KeystoreDatabase(tempDir);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(db.store('address', undefined as any)).rejects.toThrow('Keystore is required');
    await db.close();
  });

  test('stores and retrieves rotation metadata', async () => {
    const db = new KeystoreDatabase(tempDir);
    const address = 'testAddress';
    const dummyMetadata: KeyRotationMetadata = {
      lastRotation: Date.now(),
      rotationCount: 1,
      previousKeyHashes: ['hash1', 'hash2']
    };
    await db.storeRotationMetadata(address, dummyMetadata);
    const retrievedMetadata = await db.getRotationMetadata(address);
    expect(retrievedMetadata).toEqual(dummyMetadata);
    await db.close();
  });

  test('storeRotationMetadata throws error when address is missing', async () => {
    const db = new KeystoreDatabase(tempDir);
    const dummyMetadata: KeyRotationMetadata = {
      lastRotation: Date.now(),
      rotationCount: 1,
      previousKeyHashes: ['hash1', 'hash2']
    };
    await expect(db.storeRotationMetadata('', dummyMetadata)).rejects.toThrow(
      'Address is required for rotation metadata'
    );
    await db.close();
  });

  test('getRotationMetadata throws error when address is missing', async () => {
    const db = new KeystoreDatabase(tempDir);
    await expect(db.getRotationMetadata('')).rejects.toThrow(
      'Address is required for rotation metadata'
    );
    await db.close();
  });

  test('operations after close throw error', async () => {
    const db = new KeystoreDatabase(tempDir);
    // Update the dummy keystore to include all required properties
    const dummyKeystore: EncryptedKeystore = {
      version: 1,
      address: 'test',
      mnemonic: 'dummy mnemonic',
      createdAt: Date.now(),
      crypto: {
        cipher: 'aes-128-ctr',
        ciphertext: 'dummy ciphertext',
        cipherparams: {
          iv: 'dummy iv'
        },
        kdf: 'scrypt',
        kdfparams: {
          dklen: 32,
          n: 262144,
          p: 1,
          r: 8,
          salt: 'dummy salt'
        },
        mac: 'dummy mac'
      },
    };
    await db.store('test', dummyKeystore);
    await db.close();
    // Expect operations on a closed database to throw an error.
    await expect(db.get('test')).rejects.toThrow();
  });
});
