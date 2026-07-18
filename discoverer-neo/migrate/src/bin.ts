#!/usr/bin/env node
/**
 * `dn-migrate` executable shim. All real logic lives in `cli.ts`; this file
 * exists only to be the bin entrypoint, so `cli.ts` stays a plain importable
 * module (no top-level side effects, no `import.meta`).
 */
import { main } from './cli.js';

void main();
