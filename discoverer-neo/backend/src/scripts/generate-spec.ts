import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';

/**
 * Generate the OpenAPI specification JSON file.
 *
 * Usage:  npm run generate-spec
 *
 * Reads the Fastify app routes + schemas and writes a complete
 * OpenAPI 3.0 spec to `openapi-spec.json` in the backend root.
 */
async function main() {
  const app = await buildApp();
  await app.ready();

  const spec = app.swagger();
  const outputPath = fileURLToPath(new URL('../../openapi-spec.json', import.meta.url));

  writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`OpenAPI spec written to ${outputPath}`);
  console.log(`  Paths: ${Object.keys(spec.paths ?? {}).length}`);
  console.log(`  Tags: ${(spec.tags ?? []).map((t: { name: string }) => t.name).join(', ')}`);
  console.log(`  Title: ${spec.info?.title}`);
  console.log(`  Version: ${spec.info?.version}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
