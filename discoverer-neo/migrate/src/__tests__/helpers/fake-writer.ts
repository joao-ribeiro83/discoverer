/**
 * Re-export of the in-memory `MigrationWriter` fake, which now lives in
 * `src/testing/` so it ships in the package's `./testing` subpath export and
 * can be reused by other workspaces. Existing test imports keep working.
 */

export * from '../../testing/fake-writer.js';
