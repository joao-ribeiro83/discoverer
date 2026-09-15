import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dump as toYaml } from 'js-yaml';
import { buildApp } from '../app.js';

/**
 * Generate the OpenAPI spec and the two docs that must never drift from it.
 *
 * Usage:  npm run generate-spec --workspace backend
 *
 * Reads the Fastify app routes + schemas (the only source of truth) and writes:
 *   - backend/openapi-spec.json   (gitignored, for tooling)
 *   - docs/api/openapi.yaml       (committed)
 *   - docs/api/endpoints.md       (committed)
 * CI re-runs this and diffs docs/api/ to catch drift (see DOC-05).
 */

type Schema = Record<string, unknown>;

function sketch(schema: Schema | undefined, depth = 0): string {
  if (!schema) return 'any';
  if (schema.enum) return (schema.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  const type = schema.type as string | undefined;
  if (type === 'array') return `${sketch(schema.items as Schema, depth)}[]`;
  if (type === 'object' || schema.properties) {
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    const required = new Set((schema.required as string[]) ?? []);
    const keys = Object.keys(props);
    if (keys.length === 0) return 'object';
    if (depth > 3) return '{ ... }';
    const indent = '  '.repeat(depth + 1);
    const lines = keys.map((k) => {
      const optional = required.has(k) ? '' : '?';
      return `${indent}${k}${optional}: ${sketch(props[k], depth + 1)}`;
    });
    return `{\n${lines.join('\n')}\n${'  '.repeat(depth)}}`;
  }
  if (type === 'string' && schema.format) return `string (${schema.format as string})`;
  return type ?? 'any';
}

function renderRequestBody(op: Schema): string {
  const body = op.requestBody as Schema | undefined;
  if (!body) return '';
  const content = body.content as Record<string, Schema> | undefined;
  const json = content?.['application/json'];
  if (!json) return '';
  return `\n**Request body:**\n\`\`\`\n${sketch(json.schema as Schema)}\n\`\`\`\n`;
}

function renderParams(op: Schema): string {
  const params = op.parameters as Schema[] | undefined;
  if (!params || params.length === 0) return '';
  const rows = params.map((p) => {
    const schema = (p.schema as Schema) ?? {};
    const type = sketch(schema).replace(/\n/g, ' ').replace(/\|/g, '\\|');
    return `| \`${String(p.name)}\` | ${String(p.in)} | ${p.required ? 'yes' : 'no'} | ${type} |`;
  });
  return `\n**Parameters:**\n\n| Name | In | Required | Type |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
}

function renderResponses(op: Schema): string {
  const responses = (op.responses ?? {}) as Record<string, Schema>;
  const rows = Object.entries(responses).map(([status, resp]) => {
    const content = resp.content as Record<string, Schema> | undefined;
    const json = content?.['application/json'];
    const body = json
      ? sketch(json.schema as Schema)
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\|/g, '\\|')
      : '—';
    return `| ${status} | ${body} |`;
  });
  return `\n**Responses:**\n\n| Status | Body |\n| --- | --- |\n${rows.join('\n')}\n`;
}

function renderEndpointsMarkdown(spec: Schema): string {
  const tags = ((spec.tags as Schema[]) ?? []).map((t) => t.name as string);
  const paths = (spec.paths ?? {}) as Record<string, Record<string, Schema>>;

  // Group operations by their first tag, preserving the tag declaration order.
  const byTag = new Map<string, { method: string; path: string; op: Schema }[]>();
  for (const tag of tags) byTag.set(tag, []);
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = ((op.tags as string[]) ?? ['Untagged'])[0] ?? 'Untagged';
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push({ method: method.toUpperCase(), path, op });
    }
  }

  let out = `# API Endpoints Reference

<!-- GENERATED FILE. Do not edit by hand — run \`npm run generate-spec --workspace backend\`.
     Source of truth: backend/src/routes/**, rendered via @fastify/swagger. -->

Reference for every Discoverer Neo REST API endpoint, generated directly from the live
OpenAPI spec. Endpoints marked **Public** need no token; every other endpoint requires the
\`Authorization: Bearer <token>\` header (see [Authentication Guide](authentication.md)).

## Base URL

- Development: \`http://localhost:3000/api\`
- Production: the deployed origin's \`/api\`

## Interactive documentation

The backend serves this same spec as interactive Swagger UI at \`/api/docs\` while running.

## Endpoints by category
`;

  for (const [tag, ops] of byTag) {
    if (ops.length === 0) continue;
    out += `\n### ${tag}\n`;
    for (const { method, path, op } of ops) {
      const auth = op.security ? '' : ' — **Public**';
      out += `\n#### ${method} ${path}${auth}\n`;
      out += renderParams(op);
      out += renderRequestBody(op);
      out += renderResponses(op);
    }
  }

  return out;
}

async function main() {
  const app = await buildApp();
  await app.ready();

  const spec = app.swagger() as Schema;

  const jsonPath = fileURLToPath(new URL('../../openapi-spec.json', import.meta.url));
  writeFileSync(jsonPath, JSON.stringify(spec, null, 2));

  const yamlPath = fileURLToPath(new URL('../../../docs/api/openapi.yaml', import.meta.url));
  writeFileSync(yamlPath, toYaml(spec, { lineWidth: 100 }));

  const mdPath = fileURLToPath(new URL('../../../docs/api/endpoints.md', import.meta.url));
  writeFileSync(mdPath, renderEndpointsMarkdown(spec));

  const pathCount = Object.keys((spec.paths as Schema) ?? {}).length;
  const opCount = Object.values((spec.paths as Record<string, Schema>) ?? {}).reduce(
    (n, methods) => n + Object.keys(methods).length,
    0,
  );
  console.log(`OpenAPI spec: ${pathCount} paths, ${opCount} operations`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${yamlPath}`);
  console.log(`  ${mdPath}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
