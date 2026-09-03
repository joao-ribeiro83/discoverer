/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  // Points DATABASE_URL at the throwaway test database and refuses to run
  // against anything else — these suites DELETE FROM the tables they touch.
  // setupFiles (not setupFilesAfterEach) so it lands before any module reads
  // config and builds a connection pool.
  setupFiles: ['<rootDir>/src/__tests__/setup/test-database.ts'],

  /**
   * Exit once the run is done instead of waiting for the event loop to drain.
   *
   * `src/db/index.ts` creates a module-level `pg` Pool at import time. It is
   * owned by the module, not by the Fastify app, so a suite's `app.close()`
   * never ends it — and an open pg pool keeps the event loop alive forever.
   * Jest therefore printed its full summary and then hung, holding a database
   * connection open indefinitely.
   *
   * That is not merely untidy: abandoned runs have already cost this repo real
   * data. Two forgotten jest processes sat for hours, and the unscoped DELETEs
   * they run took a registered Oracle data source with them.
   *
   * Closing the pool per test file does NOT work here — the module registry is
   * shared across files in a worker, so ending it after the first file breaks
   * every file after it (verified: 35 failures with "Failed query: insert
   * into business_areas"). A `globalTeardown` runs in its own context and
   * would end a different, unused pool.
   *
   * So the run is terminated once results are reported. Everything the suite
   * asserts has already completed by then. If you need to investigate a real
   * leak, run a single suite with `--detectOpenHandles`, which overrides this.
   */
  forceExit: true,
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
          // Resolve the migrate workspace to its TypeScript SOURCE for types
          // too, mirroring moduleNameMapper above. Without this, ts-jest
          // type-checks the import through package.json "exports" and needs
          // migrate/dist/**/*.d.ts to exist — so a stale or missing build made
          // the whole suite fail to LOAD (TS2307) with zero tests run, which
          // reads like a broken suite rather than a missing build step.
          baseUrl: '.',
          paths: {
            '@discoverer-neo/migrate': ['../migrate/src/index.ts'],
            '@discoverer-neo/migrate/testing': ['../migrate/src/testing/index.ts'],
          },
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
  // ponytail: baseline from the 2026-09-03 measured run (lines 75.38%,
  // branches 56.1%) — raise as coverage improves, not a target to hit blind.
  coverageThreshold: {
    global: {
      branches: 56,
    },
  },
};
