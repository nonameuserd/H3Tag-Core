import { DatabaseTransaction } from '../../database/database-transaction';

/**
 * FakeBatch simulates the AbstractChainedBatch.
 * It collects operations and applies them to the fake database on write.
 */
class FakeBatch {
  operations: Array<{ type: 'put' | 'del'; key: string; value?: string }> = [];
  // 'shouldFail' forces the write to return an error (simulating a failure)
  constructor(private fakeDB: FakeDB, private shouldFail: boolean = false) {}

  put(key: string, value: string) {
    this.operations.push({ type: 'put', key, value });
  }

  del(key: string) {
    this.operations.push({ type: 'del', key });
  }

  write(callback: (error?: Error) => void) {
    if (this.shouldFail) {
      // Force the write to fail
      return callback(new Error('Batch write failed'));
    }
    try {
      // Apply each operation to the fake database's data map
      for (const op of this.operations) {
        if (op.type === 'put') {
          this.fakeDB.data.set(op.key, op.value!);
        } else if (op.type === 'del') {
          this.fakeDB.data.delete(op.key);
        }
      }
      callback();
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

/**
 * FakeDB simulates the minimal blockchain schema with a LevelDB-like interface.
 * - data: in-memory storage
 * - db.get: returns a value or throws if not found
 * - db.batch: returns a new FakeBatch instance
 */
class FakeDB {
  data: Map<string, string> = new Map();
  // flag to simulate failure; if true, all new batches will fail on write
  failBatchWrite = false;
  
  db = {
    get: async (key: string) => {
      if (this.data.has(key)) {
        return this.data.get(key)!;
      } else {
        throw new Error('NotFound');
      }
    },
    batch: () => new FakeBatch(this, this.failBatchWrite),
  };
}

describe('DatabaseTransaction', () => {
  let fakeDB: FakeDB;

  beforeEach(() => {
    fakeDB = new FakeDB();
  });

  test('should commit put operations successfully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    await transaction.put('key1', 'value1');
    await transaction.put('key2', 'value2');
    expect(transaction.getOperationCount()).toBe(2);
    expect(transaction.hasPendingOperations()).toBe(true);
    expect(transaction.isActive()).toBe(true);

    await transaction.commit();
    expect(transaction.isCommitted()).toBe(true);
    // Verify that fakeDB was updated with new key-value pairs
    expect(fakeDB.data.get('key1')).toBe('value1');
    expect(fakeDB.data.get('key2')).toBe('value2');
    expect(transaction.getTransactionState()).toBe('committed');
  });

  test('should commit delete operations successfully', async () => {
    // Pre-populate fakeDB with values
    fakeDB.data.set('key1', 'orig1');
    fakeDB.data.set('key2', 'orig2');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    await transaction.delete('key1');
    await transaction.delete('key2');
    expect(transaction.getOperationCount()).toBe(2);

    await transaction.commit();
    expect(transaction.isCommitted()).toBe(true);
    // Verify that keys have been deleted from fakeDB
    expect(fakeDB.data.has('key1')).toBe(false);
    expect(fakeDB.data.has('key2')).toBe(false);
  });

  test('should throw error for put with missing key or value', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    await expect(transaction.put('', 'value')).rejects.toThrow('Key and value must be provided');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(transaction.put('key', null as any)).rejects.toThrow('Key and value must be provided');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(transaction.put('key', undefined as any)).rejects.toThrow('Key and value must be provided');
  });

  test('should throw error for delete with missing key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    await expect(transaction.delete('')).rejects.toThrow('Key must be provided');
  });

  test('should not allow commit after already committed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    await transaction.put('key1', 'value1');
    await transaction.commit();
    // Subsequent commit should throw an error
    await expect(transaction.commit()).rejects.toThrow('Transaction already committed');
  });

  test('should not allow operations after rollback', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    await transaction.put('key1', 'value1');
    await transaction.rollback();
    // Further operations should throw errors since the transaction is rolled back
    await expect(transaction.put('key2', 'value2')).rejects.toThrow('Transaction already rolled back');
    await expect(transaction.delete('key1')).rejects.toThrow('Transaction already rolled back');
  });

  test('should rollback and restore original values on commit failure', async () => {
    // Pre-populate fakeDB so that the original value exists
    fakeDB.data.set('key1', 'original');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    await transaction.put('key1', 'new value');

    // Force the commit's batch to fail by overriding its write method
    transaction['batch'].write = (callback: (error?: Error) => void) => {
      callback(new Error('Forced failure'));
    };

    await expect(transaction.commit()).rejects.toThrow('Transaction commit failed: Forced failure');
    expect(transaction.isRolledBack()).toBe(true);
    // Verify that the original value was restored after rollback
    expect(fakeDB.data.get('key1')).toBe('original');
    expect(transaction.getTransactionState()).toBe('rolled_back');
  });

  test('should allow rollback if no operations exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    // When no operations exist, rollback should simply mark as rolled back
    await transaction.rollback();
    expect(transaction.isRolledBack()).toBe(true);
    expect(transaction.getTransactionState()).toBe('rolled_back');
  });

  test('isActive should return correct values', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transaction = new DatabaseTransaction(fakeDB as any);
    expect(transaction.isActive()).toBe(true);
    await transaction.put('key1', 'value1');
    expect(transaction.isActive()).toBe(true);
    await transaction.commit();
    expect(transaction.isActive()).toBe(false);
  });
});
