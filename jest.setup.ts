beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterEach(async () => {
  jest.clearAllMocks();
  jest.clearAllTimers();

  // Wait for any pending promises
  await new Promise((resolve) => setImmediate(resolve));
});
