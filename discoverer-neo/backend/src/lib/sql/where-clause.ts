import {
  SqlGenerationError,
  type MapDefinition,
  type SqlGenerationOptions,
} from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { validateBindName } from './identifiers.js';

export interface WhereClauseResult {
  /** "WHERE ..." or empty string when there are no conditions. */
  sql: string;
  bindParams: Record<string, unknown>;
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
 * logicOperator of their first condition.
 */
export function buildWhereClause(
  def: MapDefinition,
  ctx: GenerationContext,
  options: SqlGenerationOptions = {},
): WhereClauseResult {
  const bindParams: Record<string, unknown> = {};
  const paramTypes = new globalThis.Map(
    def.parameters.map((p) => [p.name, p.paramType]),
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
      // PARAMETER condition
      const paramName = condition.paramName;
      if (!paramName) {
        throw new SqlGenerationError(
          `PARAMETER condition on "${item.name}" has no paramName`,
        );
      }
      validateBindName(paramName);
      const paramType = paramTypes.get(paramName);
      const provided = paramValues[paramName];

      if (op === 'IN') {
        // LIST parameters expand to one bind per value when values are
        // available; otherwise a single bind placeholder is emitted.
        const values =
          paramType === 'LIST' && provided !== undefined
            ? Array.isArray(provided)
              ? provided
              : String(provided).split(',').map((v) => v.trim())
            : undefined;
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
          const parts = Array.isArray(provided)
            ? provided
            : String(provided).split(',').map((v) => v.trim());
          if (parts.length !== 2) {
            throw new SqlGenerationError(
              `Parameter "${paramName}" must supply two values for BETWEEN`,
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

  const clauses: string[] = [];
  let first = true;
  for (const rendered of groups.values()) {
    let groupSql: string;
    if (rendered.length === 1) {
      groupSql = rendered[0]!.sql;
    } else {
      groupSql = `(${rendered
        .map((r, i) => (i === 0 ? r.sql : `${r.logicOperator} ${r.sql}`))
        .join(' ')})`;
    }
    clauses.push(
      first ? groupSql : `${rendered[0]!.logicOperator} ${groupSql}`,
    );
    first = false;
  }

  // Row-level security predicates are ANDed in, each in its own parens.
  for (const predicate of options.securityPredicates ?? []) {
    const trimmed = predicate.trim();
    if (!trimmed) continue;
    if (trimmed.includes(';')) {
      throw new SqlGenerationError(
        'Security predicates must not contain statement separators',
      );
    }
    clauses.push(first ? `(${trimmed})` : `AND (${trimmed})`);
    first = false;
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join('\n  ')}` : '',
    bindParams,
  };
}
