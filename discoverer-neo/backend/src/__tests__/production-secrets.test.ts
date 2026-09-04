import { INSECURE_DEFAULTS, assertProductionSecrets } from '../config.js';

/**
 * The guard that refuses to boot in production on a secret published in this
 * repository. Asserted as a pure function over an env object rather than by
 * booting a production process — the point is that each default is caught on
 * its own, and starting a real server to prove that would be slower and less
 * precise.
 */
const SAFE = {
  JWT_SECRET: 'a-real-secret-that-is-long-enough',
  ENCRYPTION_KEY: 'a-real-encryption-key-that-is-long-enough',
};

describe('assertProductionSecrets', () => {
  it('throws in production on the default JWT_SECRET', () => {
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        ...SAFE,
        JWT_SECRET: INSECURE_DEFAULTS.JWT_SECRET,
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('throws in production on the default ENCRYPTION_KEY', () => {
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        ...SAFE,
        ENCRYPTION_KEY: INSECURE_DEFAULTS.ENCRYPTION_KEY,
      }),
    ).toThrow(/ENCRYPTION_KEY/);
  });

  it('names both when both are still default', () => {
    expect(() =>
      assertProductionSecrets({ NODE_ENV: 'production', ...INSECURE_DEFAULTS }),
    ).toThrow(/JWT_SECRET and ENCRYPTION_KEY/);
  });

  it('allows production once both are replaced', () => {
    expect(() => assertProductionSecrets({ NODE_ENV: 'production', ...SAFE })).not.toThrow();
  });

  it.each(['development', 'test'])('leaves %s alone on the defaults', (env) => {
    // Development stays frictionless on purpose: the guard exists to stop a
    // production deployment, not to make a laptop set two environment
    // variables before it will start.
    expect(() =>
      assertProductionSecrets({ NODE_ENV: env, ...INSECURE_DEFAULTS }),
    ).not.toThrow();
  });
});
