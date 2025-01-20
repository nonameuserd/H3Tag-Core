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