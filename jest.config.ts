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
  moduleNameMapper: {
    "@h3tag-blockchain/crypto": "<rootDir>/packages/crypto/src",
    "@h3tag-blockchain/shared": "<rootDir>/packages/shared/src",
  },
  moduleDirectories: ["node_modules", "packages"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};

export default config;
