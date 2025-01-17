import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}], // Updated transform configuration
  },
  fakeTimers: {
    enableGlobally: true, // Enable fake timers globally
  },
};

export default config;
