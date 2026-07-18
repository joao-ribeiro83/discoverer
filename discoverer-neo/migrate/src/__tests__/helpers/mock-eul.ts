/**
 * Re-export of the mock EUL fixtures, which now live in `src/testing/` so they
 * ship in the package's `./testing` subpath export and can be reused by other
 * workspaces (the backend's migration-service tests). Existing test imports of
 * this path keep working unchanged.
 */

export * from '../../testing/mock-eul.js';
