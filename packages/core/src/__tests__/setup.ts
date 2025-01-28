// custom jest matchers if needed
expect.extend({
  toBeValidHash(received: string) {
    const pass = typeof received === 'string' && /^[a-f0-9]{64}$/i.test(received);
    return {
      message: () =>
        `expected ${received} to be a valid 32-byte hex string hash`,
      pass,
    };
  },
});

// Global test timeout
jest.setTimeout(10000);

// Clean up any resources after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Mock the static blockchain instance before any tests run
jest.mock('../blockchain/blockchain', () => ({
  Blockchain: {
    getInstance: jest.fn().mockReturnValue({
      calculateBlockReward: jest.fn().mockReturnValue(BigInt(50)),
      getValidatorCount: jest.fn().mockResolvedValue(10),
      getCurrentHeight: jest.fn().mockReturnValue(1),
    }),
  },
}));

// Increase max listeners to avoid warning
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 20; 