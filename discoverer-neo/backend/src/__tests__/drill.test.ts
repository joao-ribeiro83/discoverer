import { describe, it, expect } from '@jest/globals';
import { refuseHierarchyDrill, DrillNotAvailableError } from '../services/drill.service.js';

// The rest of drill.service.ts (resolveAliasToItem, toDrillDetailDefinition,
// drillToDetail) reads real map definitions via loadMapDefinition and is
// covered against real Postgres in
// __tests__/integration/map-execution-routes.test.ts, alongside the sibling
// /execute route it shares its security gates with. refuseHierarchyDrill is
// the one pure function here — a real DB adds nothing to testing it.
describe('refuseHierarchyDrill', () => {
  it('always refuses, naming why (no hierarchy data) and the alternative', () => {
    expect(() => refuseHierarchyDrill()).toThrow(DrillNotAvailableError);
    expect(() => refuseHierarchyDrill()).toThrow(/hierarchy/i);
    expect(() => refuseHierarchyDrill()).toThrow(/drill to detail/i);
  });
});
