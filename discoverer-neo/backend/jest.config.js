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
    // don't require a prior `npm run build -w @discoverer-neo/core`.
    '^@discoverer-neo/core/db/schema$': '<rootDir>/../migrate/src/db/schema.ts',
    '^@discoverer-neo/core/testing$': '<rootDir>/../migrate/src/testing/index.ts',
    '^@discoverer-neo/core/migration$': '<rootDir>/../migrate/src/index.ts',
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
          // subpaths resolve — e.g. '@discoverer-neo/core/testing'.
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
            '@discoverer-neo/core/db/schema': ['../migrate/src/db/schema.ts'],
            '@discoverer-neo/core/migration': ['../migrate/src/index.ts'],
            '@discoverer-neo/core/testing': ['../migrate/src/testing/index.ts'],
          },
        },
      },
    ],
  },
  testMatch: ['**/?(*.)+(spec|test).ts'],
  clearMocks: true,
  // Every suite here shares one database, so the whole run is sequential. The
  // split between `__tests__/` and `__tests__/integration/` is about what a
  // suite NEEDS, not about how it is scheduled: `npm run test:unit` is the
  // fast loop that touches no infrastructure.
  maxWorkers: process.env.JEST_MAX_WORKERS
    ? Number(process.env.JEST_MAX_WORKERS)
    : 1,
  /**
   * A floor at what the suite measurably achieves, not a target — raise it in
   * the commit that earns it.
   *
   * Branches, not lines: for a SQL generator full of conditionals a line
   * figure says almost nothing about whether the interesting paths were taken.
   *
   * 71% is the 2026-09-03 measured run (87.23% lines, 71.86% branches over
   * 1 123 tests). The 56.1% the audit reported came from a six-week-old
   * committed artefact — which is the argument against committing one.
   */
  coverageThreshold: {
    global: {
      branches: 71,
    },
  },
};
