import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}],
  },
  fakeTimers: {
    enableGlobally: true,
  },
  maxWorkers: 1,
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};

export default config;
