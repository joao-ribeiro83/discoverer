import {
  SqlGenerationError,
  type MapDefinition,
  type SecurityPredicate,
  type SqlGenerationOptions,
} from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { validateBindName } from './identifiers.js';
import { ALIAS_TOKEN_RE, referencedBindNames } from './security-predicates.js';

export interface WhereClauseResult {
  /** "WHERE ..." or empty string when there are no conditions. */
  sql: string;
  bindParams: Record<string, unknown>;
}

/**
 * A LIST or BETWEEN parameter arrives either already split into an array or as
 * one comma-joined string. Anything else is a single value — splitting its
 * `String()` form would only turn an object into `[object Object]`.
 */
function toValueList(provided: unknown): unknown[] {
  if (Array.isArray(provided)) return provided as unknown[];
  if (typeof provided === 'string') return provided.split(',').map((v) => v.trim());
  return [provided];
}

/**
 * Build the WHERE clause.
 *
 * Safety contract: every runtime value — static condition values as well as
 * parameter values — becomes a bind variable. Nothing from `value` or
 * `parameterValues` is ever concatenated into the SQL text.
 *
 * Grouping semantics: conditions sharing a groupId are parenthesized
 * together; within a group each subsequent condition is joined by its own
 * logicOperator. Groups (and ungrouped conditions) are joined by the
 * logicOperator of their first condition. A group's first row therefore says
 * how the group joins the previous one, and the rest say how they join inside
 * it — one column doing two jobs by position.
 *
 * Two levels is all of it: there is no nesting below a group. The migration
 * relies on that being enough (see `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7.5)
 * and reports any Discoverer condition that needs more.
 */
export function buildWhereClause(
  def: MapDefinition,
  ctx: GenerationContext,
  options: SqlGenerationOptions = {},
): WhereClauseResult {
  const bindParams: Record<string, unknown> = {};
  // Keyed by bind name: a PARAMETER condition stores its parameter's
  // `bind_name`, and `options.parameterValues` arrives keyed the same way
  // (parameter-resolver.ts turns prompt-keyed input into bind-keyed output).
  const paramTypes = new globalThis.Map(
    def.parameters.map((p) => [p.bindName, p.paramType]),
  );
  // Bind name → prompt, so an error can name the parameter the way the person
  // reading it knows it.
  const paramLabels = new globalThis.Map(
    def.parameters.map((p) => [p.bindName, p.name]),
  );
  const paramValues = options.parameterValues ?? {};
  let staticBindCounter = 0;

  interface RenderedCondition {
    sql: string;
    logicOperator: 'AND' | 'OR';
    displayOrder: number;
  }

  function bindValueFor(
    dataType: string | null | undefined,
    raw: string,
  ): unknown {
    if (dataType && /NUMBER|INTEGER|FLOAT|DECIMAL/i.test(dataType)) {
      const n = Number(raw);
      if (Number.isNaN(n)) {
        throw new SqlGenerationError(
          `Condition value "${raw}" is not a valid number`,
        );
      }
      return n;
    }
    return raw;
  }

  /** A bind placeholder, wrapped in TO_DATE for DATE-typed operands. */
  function placeholder(name: string, isDate: boolean): string {
    validateBindName(name);
    return isDate ? `TO_DATE(:${name}, 'YYYY-MM-DD')` : `:${name}`;
  }

  function renderCondition(
    entry: MapDefinition['conditions'][number],
  ): RenderedCondition {
    const { condition, item, folder } = entry;
    const lhs = ctx.itemExpression(item, folder);
    const isDate = !!(
      item.dataType && /DATE|TIMESTAMP/i.test(item.dataType)
    );
    const op = condition.operator;

    let sql: string;

    if (op === 'IS_NULL') {
      sql = `${lhs} IS NULL`;
    } else if (condition.conditionType === 'STATIC') {
      if (condition.value === null || condition.value === undefined) {
        throw new SqlGenerationError(
          `STATIC condition on "${item.name}" has no value`,
        );
      }
      const base = `c${staticBindCounter++}`;

      if (op === 'IN') {
        const values = condition.value.split(',').map((v) => v.trim());
        const names = values.map((v, i) => {
          const bind = `${base}_${i}`;
          bindParams[bind] = bindValueFor(item.dataType, v);
          return placeholder(bind, isDate);
        });
        sql = `${lhs} IN (${names.join(', ')})`;
      } else if (op === 'BETWEEN') {
        const parts = condition.value.split(',').map((v) => v.trim());
        if (parts.length !== 2) {
          throw new SqlGenerationError(
            `BETWEEN condition on "${item.name}" needs two comma-separated values`,
          );
        }
        bindParams[`${base}_lo`] = bindValueFor(item.dataType, parts[0]!);
        bindParams[`${base}_hi`] = bindValueFor(item.dataType, parts[1]!);
        sql = `${lhs} BETWEEN ${placeholder(`${base}_lo`, isDate)} AND ${placeholder(`${base}_hi`, isDate)}`;
      } else {
        bindParams[base] = bindValueFor(item.dataType, condition.value);
        sql = `${lhs} ${op} ${placeholder(base, isDate)}`;
      }
    } else {
      // PARAMETER condition. `param_name` holds the parameter's *bind name*,
      // never the prompt the user sees — the prompt is free text and is
      // routinely something like `Dt Fim Vigência >=`, which no bind variable
      // can be called. See `map_parameters.bindName` in db/schema.ts.
      const paramName = condition.paramName;
      if (!paramName) {
        throw new SqlGenerationError(
          `PARAMETER condition on "${item.name}" has no paramName`,
        );
      }
      // Bind names are derived and uniquified where the row is written, so a
      // bad one here means something wrote the row bypassing that path.
      validateBindName(paramName);
      const paramLabel = paramLabels.get(paramName) ?? paramName;
      const paramType = paramTypes.get(paramName);
      const provided = paramValues[paramName];

      if (op === 'IN') {
        // LIST parameters expand to one bind per value when values are
        // available; otherwise a single bind placeholder is emitted.
        const values =
          paramType === 'LIST' && provided !== undefined ? toValueList(provided) : undefined;
        if (values && values.length > 0) {
          const names = values.map((v, i) => {
            const bind = `${paramName}_${i}`;
            bindParams[bind] = v;
            return placeholder(bind, isDate);
          });
          sql = `${lhs} IN (${names.join(', ')})`;
        } else {
          if (provided !== undefined) bindParams[paramName] = provided;
          sql = `${lhs} IN (${placeholder(paramName, isDate)})`;
        }
      } else if (op === 'BETWEEN') {
        const lo = `${paramName}_lo`;
        const hi = `${paramName}_hi`;
        if (provided !== undefined) {
          const parts = toValueList(provided);
          if (parts.length !== 2) {
            throw new SqlGenerationError(
              `Parameter "${paramLabel}" must supply two values for BETWEEN`,
            );
          }
          bindParams[lo] = parts[0];
          bindParams[hi] = parts[1];
        }
        sql = `${lhs} BETWEEN ${placeholder(lo, isDate)} AND ${placeholder(hi, isDate)}`;
      } else {
        if (provided !== undefined) bindParams[paramName] = provided;
        sql = `${lhs} ${op} ${placeholder(paramName, isDate)}`;
      }
    }

    return {
      sql,
      logicOperator: condition.logicOperator,
      displayOrder: condition.displayOrder,
    };
  }

  // Group conditions (null groupId → singleton group per condition).
  const groups = new globalThis.Map<string, RenderedCondition[]>();
  const sorted = [...def.conditions].sort(
    (a, b) => a.condition.displayOrder - b.condition.displayOrder,
  );
  for (const entry of sorted) {
    const key = entry.condition.groupId ?? `__single_${entry.condition.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(renderCondition(entry));
  }

  const conditionClauses: string[] = [];
  let first = true;
  let joinedByOr = false;
  for (const rendered of groups.values()) {
    let groupSql: string;
    if (rendered.length === 1) {
      groupSql = rendered[0]!.sql;
    } else {
      groupSql = `(${rendered
        .map((r, i) => (i === 0 ? r.sql : `${r.logicOperator} ${r.sql}`))
        .join(' ')})`;
    }
    if (!first && rendered[0]!.logicOperator === 'OR') joinedByOr = true;
    conditionClauses.push(
      first ? groupSql : `${rendered[0]!.logicOperator} ${groupSql}`,
    );
    first = false;
  }

  // The map's own conditions become one clause. When any group is ORed onto
  // the previous one the whole block has to be bracketed before anything is
  // ANDed after it: `a OR b AND <security>` is `a OR (b AND <security>)` in
  // SQL, which would return every row matching `a` regardless of the security
  // predicate.
  //
  // The bracketing is unconditional once an OR is present — not conditional on
  // a security predicate actually following — so the shape of the clause never
  // depends on who is running the query. An all-AND block needs no brackets
  // and keeps its existing text, which is the overwhelming majority of maps.
  const clauses: string[] = [];
  if (conditionClauses.length > 0) {
    clauses.push(
      joinedByOr ? `(${conditionClauses.join('\n  ')})` : conditionClauses.join('\n  '),
    );
  }
  first = clauses.length === 0;

  // Row-level security predicates are ANDed in, each in its own parens.
  const securityBinds = options.securityBindParams ?? {};
  for (const entry of options.securityPredicates ?? []) {
    const predicate: SecurityPredicate =
      typeof entry === 'string' ? { sql: entry } : entry;
    let trimmed = predicate.sql.trim();
    if (!trimmed) continue;
    if (trimmed.includes(';')) {
      throw new SqlGenerationError(
        'Security predicates must not contain statement separators',
      );
    }

    // FOLDER-targeted rules refer to their folder via {alias}; resolve it to
    // the folder's assigned query alias. A folder already used by the query
    // keeps its alias; aliasFor also marks the folder used, which is safe
    // because the FROM clause is built after the WHERE clause.
    if (ALIAS_TOKEN_RE.test(trimmed)) {
      ALIAS_TOKEN_RE.lastIndex = 0;
      if (!predicate.folderId) {
        throw new SqlGenerationError(
          'Security predicate uses {alias} but has no folder target',
        );
      }
      trimmed = trimmed.replace(ALIAS_TOKEN_RE, ctx.aliasFor(predicate.folderId));
    }
    ALIAS_TOKEN_RE.lastIndex = 0;

    // Only binds a predicate actually references may enter the bind set —
    // Oracle rejects statements with unused binds. A referenced bind that is
    // neither supplied nor already bound fails closed; a clash with an
    // existing bind of a different value is a configuration error, not
    // something to silently overwrite.
    for (const bind of referencedBindNames(trimmed)) {
      if (bind in bindParams) {
        if (bind in securityBinds && bindParams[bind] !== securityBinds[bind]) {
          throw new SqlGenerationError(
            `Security predicate bind :${bind} clashes with an existing query bind`,
          );
        }
        continue;
      }
      if (!(bind in securityBinds)) {
        throw new SqlGenerationError(
          `Security predicate references bind :${bind} but no value was supplied`,
        );
      }
      validateBindName(bind);
      bindParams[bind] = securityBinds[bind];
    }

    clauses.push(first ? `(${trimmed})` : `AND (${trimmed})`);
    first = false;
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join('\n  ')}` : '',
    bindParams,
  };
}
