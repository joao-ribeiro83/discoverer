import { isSensitiveKey, redact } from '../plugins/audit.js';

/**
 * The redactor is the only thing standing between a request body and the
 * audit log, and it already failed once: it matched key names EXACTLY, so
 * `passwordEnc` (the Oracle password, which the client sends in plaintext for
 * the server to encrypt) and `newPassword` were both stored in the clear.
 * 174 Oracle data-source passwords and 5 user passwords went in that way.
 *
 * These cases are the two that were missed plus the shapes a real request
 * actually has — nested, arrayed, and separator-spelled.
 */
describe('isSensitiveKey', () => {
  it.each([
    // The two that leaked.
    'passwordEnc',
    'newPassword',
    // The names the old exact list did cover.
    'password',
    'passwordHash',
    'token',
    'refreshToken',
    'accessToken',
    'secret',
    'apiKey',
    'authorization',
    // What substring matching buys: names nobody enumerated.
    'currentPassword',
    'clientSecret',
    'apiToken',
    'dbCredential',
    'credentials',
    // Separators and casing must not create a hole.
    'api_key',
    'API-KEY',
    'client_secret',
    'NEW_PASSWORD',
  ])('treats %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['name', 'host', 'port', 'username', 'description', 'serviceName', 'id'])(
    'leaves %s alone',
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    },
  );
});

describe('redact', () => {
  it('redacts passwordEnc and newPassword from a captured request body', () => {
    // The two request shapes that caused the incident: registering a data
    // source, and changing a password.
    expect(
      redact({
        name: 'SIID_TESTES',
        username: 'siid_testes',
        passwordEnc: 'the-real-oracle-password',
      }),
    ).toEqual({
      name: 'SIID_TESTES',
      username: 'siid_testes',
      passwordEnc: '[REDACTED]',
    });

    expect(redact({ currentPassword: 'old-one', newPassword: 'new-one' })).toEqual({
      currentPassword: '[REDACTED]',
      newPassword: '[REDACTED]',
    });
  });

  it('reaches into nested objects and arrays', () => {
    expect(
      redact({
        body: { dataSource: { host: 'db.example.com', password: 'secret-value' } },
        users: [{ email: 'a@example.com', temporaryPassword: 'abc' }],
      }),
    ).toEqual({
      body: { dataSource: { host: 'db.example.com', password: '[REDACTED]' } },
      users: [{ email: 'a@example.com', temporaryPassword: '[REDACTED]' }],
    });
  });

  it('passes through primitives, null and undefined unchanged', () => {
    expect(redact('plain')).toBe('plain');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('stops descending past the depth ceiling', () => {
    // Eight levels deep: the ceiling is six, so the innermost password
    // survives. That is the documented limit, not an oversight — a body that
    // deep is not a shape this API accepts, and an unbounded walk on
    // attacker-shaped JSON is its own problem.
    let deep: Record<string, unknown> = { password: 'kept' };
    for (let i = 0; i < 8; i += 1) deep = { nested: deep };

    expect(JSON.stringify(redact(deep))).toContain('kept');
  });
});
