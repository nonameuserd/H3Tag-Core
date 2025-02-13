jest.mock('@h3tag-blockchain/crypto', () => ({
  HybridCrypto: {
    verify: jest.fn().mockResolvedValue(true),
    sign: jest.fn().mockResolvedValue('mockSignature'),
    hash: jest.fn().mockResolvedValue('mockHash')
  },
  KeyManager: {
    generateKeyPair: jest.fn().mockResolvedValue({
      publicKey: 'mockPublicKey',
      privateKey: 'mockPrivateKey'
    })
  }
}));

// Mock shared module
jest.mock('@h3tag-blockchain/shared', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  ConfigService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn()
    })
  }
}));

// Global test setup
beforeAll(() => {
  // Add any global setup here
});

// Global test cleanup
afterAll(() => {
  // Add any global cleanup here
  jest.clearAllMocks();
  jest.resetModules();
}); 