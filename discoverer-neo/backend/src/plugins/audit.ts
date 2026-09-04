import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { log as writeAuditEntry } from '../services/audit.service.js';

// ---------------------------------------------------------------------------
// Audit logging hook.
//
// Registered globally (before routes, like plugins/metrics.ts) so every
// mutating request — including auth login/logout/refresh, exports, and
// migrations, all of which are just POST routes — is captured without each
// route handler having to call the audit service itself. Runs on `onSend`
// (not `onResponse`) because that is the last hook with access to the
// serialized response body; the actual DB write is fire-and-forget so a slow
// or failing audit insert never delays or breaks the real response.
// ---------------------------------------------------------------------------

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const DEFAULT_EXCLUDE_PREFIXES = ['/api/health', '/metrics', '/documentation'];

// Trailing route segments that name an operation rather than a resource —
// used to find the resource segment when the URL ends in one of these
// (e.g. POST /api/schedules/:id/trigger should audit as entityType
// 'schedules', not 'trigger').
const ACTION_SEGMENTS = new Set([
  'login',
  'logout',
  'refresh',
  'trigger',
  'toggle',
  'execute',
  'execute-async',
  'assignments',
  'test',
  'detect',
  'analyze',
  'run',
  'import',
]);

// Substrings that make a key sensitive. Its values are replaced (at any
// depth) before a request/response body is stored — audit details must never
// carry credentials or bearer tokens.
//
// Substrings, not exact names: an exact list is a list of the names somebody
// thought of, and two of them were missing. `passwordEnc` (the client sends
// the Oracle password as plaintext; the server encrypts it) and `newPassword`
// were both written to audit_log in the clear. `apikey` and `authorization`
// are listed separately because they contain none of the other four.
const SENSITIVE_KEY_SUBSTRINGS = [
  'password',
  'secret',
  'token',
  'credential',
  'apikey',
  'authorization',
];

/**
 * True when `key` names a value that must never be stored.
 *
 * Case-insensitive, and separators are stripped first so `api_key` and
 * `api-key` match `apikey` the same way `apiKey` does.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => normalized.includes(needle));
}

const MAX_DETAIL_CHARS = 8000;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? '[REDACTED]' : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

function truncate(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length <= MAX_DETAIL_CHARS) return value;
  return { truncated: true, preview: serialized.slice(0, MAX_DETAIL_CHARS) };
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') return undefined;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function unwrapData(responseData: unknown): Record<string, unknown> | null {
  if (!responseData || typeof responseData !== 'object') return null;
  const root = responseData as Record<string, unknown>;
  return root.data && typeof root.data === 'object'
    ? (root.data as Record<string, unknown>)
    : root;
}

function extractResponseId(responseData: unknown): string | null {
  const data = unwrapData(responseData);
  // Job-style resources (exports, migrations) key their id as `jobId`
  // rather than `id`.
  const id = data?.id ?? data?.jobId;
  return typeof id === 'string' ? id : null;
}

// Login has no request.user (the request is unauthenticated) — the acting
// user only exists in the response body once login succeeds.
function extractLoginUserId(responseData: unknown): string | null {
  const user = unwrapData(responseData)?.user;
  const id = user && typeof user === 'object' ? (user as Record<string, unknown>).id : undefined;
  return typeof id === 'string' ? id : null;
}

/**
 * Derives {entityType, entityId} from a route pattern like
 * '/api/business-areas/:baId/folders/:id'. Best-effort: routes are varied
 * enough (nested resources, trailing action verbs, param-less create routes)
 * that this is a heuristic, not a parser of route semantics.
 */
export function deriveEntity(
  routePattern: string,
  params: Record<string, string>,
  responseData: unknown,
): { entityType: string; entityId: string | null } {
  const segments = routePattern.split('/').filter((s) => s.length > 0 && s !== 'api');
  if (segments.length === 0) return { entityType: 'unknown', entityId: null };

  let last = segments[segments.length - 1]!;

  // Trailing action verb (possibly after a trailing param, e.g. .../:id/trigger,
  // or bare, e.g. .../search) — step back to the resource it acts on.
  if (ACTION_SEGMENTS.has(last) && segments.length > 1) {
    segments.pop();
    last = segments[segments.length - 1]!;
  }

  if (last.startsWith(':')) {
    const entityType = segments.length > 1 ? segments[segments.length - 2]! : segments[0]!;
    const entityId = params[last.slice(1)] ?? null;
    return { entityType, entityId };
  }

  // Static trailing segment: either a collection route (POST creates a new
  // entity — id comes from the response body) or a nested collection under a
  // parent id (e.g. POST /business-areas/:baId/folders — audited as the
  // child resource 'folders', matching what was actually mutated).
  return { entityType: last, entityId: extractResponseId(responseData) };
}

export interface AuditPluginOptions {
  excludeRoutes?: string[];
}

export default fp(
  (fastify, opts: AuditPluginOptions = {}) => {
    const excludePrefixes = opts.excludeRoutes ?? DEFAULT_EXCLUDE_PREFIXES;

    fastify.addHook('onSend', async (request: FastifyRequest, reply, payload) => {
      if (!MUTATING_METHODS.has(request.method)) return payload;

      const routePattern = request.routeOptions?.url ?? request.url;
      if (excludePrefixes.some((prefix) => routePattern.startsWith(prefix))) {
        return payload;
      }

      const responseData = parsePayload(payload);
      const { entityType, entityId } = deriveEntity(
        routePattern,
        (request.params as Record<string, string>) ?? {},
        responseData,
      );

      const userId = request.user?.sub ?? extractLoginUserId(responseData);

      // Fire-and-forget: never let audit persistence delay or fail the
      // actual response.
      writeAuditEntry({
        userId,
        action: `${request.method} ${routePattern}`,
        entityType,
        entityId,
        ipAddress: request.ip,
        details: truncate(
          redact({
            statusCode: reply.statusCode,
            params: request.params,
            query: request.query,
            body: request.body,
            response: responseData,
          }),
        ),
      }).catch((err) => {
        request.log.error({ err }, 'audit log write failed');
      });

      return payload;
    });
  },
  { name: 'audit' },
);
