/**
 * SEC-03 — every GET route keyed by an id attaches object-level scoping.
 *
 * Five GET-by-id routes once carried `preHandler: [fastify.authenticate]` and
 * nothing else, so any signed-in user could read folders, items, joins and
 * hierarchies across business areas they held no grant on. Each was a one-line
 * omission next to EDIT and DELETE routes that had the guard. This scan is what
 * makes the next omission a red test instead of an audit finding.
 *
 * A route passes if its registration block names a known gate — a scoping
 * preHandler, an admin-only preHandler, or one of the in-handler loaders that
 * refuse before returning data. Anything else must be listed in UNSCOPED with
 * the reason it holds no per-object data.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(__dirname, '..', 'routes');

const GATES = [
  'requireBusinessAreaAccess(',
  'requireFolderAccess(',
  'requireItemAccess(',
  'requireJoinAccess(',
  'requireHierarchyAccess(',
  'authorizeAdmin',
  'authorize(',
  'adminPreHandler',
  'loadMapWithAccess(',
  'canAccessMap(',
  'loadOwnJob(',
  'loadOwnSchedule(',
];

/** Routes with an id param and no gate, each with the reason that is safe. */
const UNSCOPED: Record<string, string> = {
  // Global catalogue: `custom_functions` has no business-area column, and the
  // list route returns every row to any signed-in user.
  'GET /api/custom-functions/:id': 'global catalogue, not business-area data',
};

function getRoutesWithParams(): Array<{ route: string; block: string }> {
  const found: Array<{ route: string; block: string }> = [];
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8');
    // Split on registrations; each chunk runs to the next `fastify.<verb>(`.
    const chunks = src.split(/(?=fastify\.(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\()/);
    for (const chunk of chunks) {
      const m = /^fastify\.get\s*(?:<[^>]*>)?\s*\(\s*['"`]([^'"`]+)['"`]/.exec(chunk);
      if (m && m[1]!.includes('/:')) {
        found.push({ route: `GET ${m[1]}`, block: chunk });
      }
    }
  }
  return found;
}

describe('SEC-03: GET-by-id routes are scoped', () => {
  const routes = getRoutesWithParams();

  it('finds the routes (guards against the scan silently matching nothing)', () => {
    const names = routes.map((r) => r.route);
    for (const known of [
      'GET /api/folders/:id',
      'GET /api/items/:id',
      'GET /api/items/:id/descendants',
      'GET /api/joins/:id',
      'GET /api/hierarchies/:id',
      'GET /api/maps/:id',
    ]) {
      expect(names).toContain(known);
    }
  });

  it('every GET route with an id param names a gate or is listed as unscoped', () => {
    const ungated = routes
      .filter(({ route, block }) => !(route in UNSCOPED) && !GATES.some((g) => block.includes(g)))
      .map((r) => r.route);
    expect(ungated).toEqual([]);
  });

  it('the unscoped list has no stale entries', () => {
    const names = new Set(routes.map((r) => r.route));
    expect(Object.keys(UNSCOPED).filter((r) => !names.has(r))).toEqual([]);
  });
});
