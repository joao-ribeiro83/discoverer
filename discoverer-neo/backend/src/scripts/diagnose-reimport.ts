/**
 * Temporary diagnostic — not part of the app. Calls reimportMaps directly
 * (bypassing the job wrapper in migration.service.ts, which flattens an
 * error down to just err.message and drops the Postgres cause chain) so the
 * real driver error is visible.
 */
import { defaultDeps } from '../services/migration.service.js';
import { reimportMaps } from '@discoverer-neo/migrate';

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  if (!dataSourceId) throw new Error('usage: diagnose-reimport.ts <dataSourceId>');

  const deps = defaultDeps();
  const connection = await deps.loadConnection(dataSourceId);
  const source = deps.makeSource(connection);
  const target = deps.makeTarget();

  try {
    const result = await reimportMaps({
      source,
      writer: target.writer,
      dryRun: false,
      onEvent: (e) => console.log(`[${e.level}] ${e.phase}: ${e.message}`),
    });
    console.log('SUCCESS');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('CAUGHT ERROR');
    console.error('message (first 300 chars):', err instanceof Error ? err.message.slice(0, 300) : String(err));
    let cause: unknown = err instanceof Error ? err.cause : undefined;
    let depth = 0;
    while (cause && depth < 8) {
      console.error(`--- cause depth ${depth} ---`);
      console.error(cause);
      cause = (cause as { cause?: unknown } | undefined)?.cause;
      depth += 1;
    }
  } finally {
    await target.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('FATAL', err);
    process.exit(1);
  });
