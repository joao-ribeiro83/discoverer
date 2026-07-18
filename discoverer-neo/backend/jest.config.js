/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Resolve the sibling migrate workspace to its TypeScript source rather
    // than its built ESM output: jest loads node_modules as CJS and would
    // choke on `export *` in migrate/dist. Mapping to source also means tests
    // don't require a prior `npm run build -w @discoverer-neo/migrate`.
    '^@discoverer-neo/migrate/testing$': '<rootDir>/../migrate/src/testing/index.ts',
    '^@discoverer-neo/migrate$': '<rootDir>/../migrate/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          // 'bundler' (not the legacy 'node') so package.json "exports"
          // subpaths resolve — e.g. '@discoverer-neo/migrate/testing'.
          moduleResolution: 'bundler',
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
