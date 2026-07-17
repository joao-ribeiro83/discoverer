/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'node',
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
  testMatch: ['**/?(*.)+(spec|test).ts'],
  clearMocks: true,
  // Integration tests share a database — run them sequentially to avoid data races.
  // Unit tests (under __tests__/ but not __tests__/integration/) can still run in parallel.
  maxWorkers: process.env.JEST_MAX_WORKERS
    ? Number(process.env.JEST_MAX_WORKERS)
    : 1,
};
