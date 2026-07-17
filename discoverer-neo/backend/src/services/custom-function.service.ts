import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  customFunctions,
  type CustomFunction,
} from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FunctionType = 'SQL' | 'PLSQL' | 'PACKAGE';

export interface FunctionParameter {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
}

export interface CreateCustomFunctionInput {
  name: string;
  description?: string | null;
  functionType: FunctionType;
  parameters?: FunctionParameter[] | null;
  returnType?: string | null;
}

export interface UpdateCustomFunctionInput {
  name?: string;
  description?: string | null;
  functionType?: FunctionType;
  parameters?: FunctionParameter[] | null;
  returnType?: string | null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const VALID_FUNCTION_TYPES: readonly FunctionType[] = [
  'SQL',
  'PLSQL',
  'PACKAGE',
];

export class CustomFunctionValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'CustomFunctionValidationError';
  }
}

/**
 * Validate that the function type is one of the allowed enum values.
 */
export function validateFunctionType(
  type: unknown,
): type is FunctionType {
  return (
    typeof type === 'string' &&
    (VALID_FUNCTION_TYPES as readonly string[]).includes(type)
  );
}

/**
 * Validate the JSONB parameter definitions. Each parameter must have a name
 * and a type; `required` (if present) must be a boolean.
 */
export function validateParameters(
  params: unknown,
): { valid: boolean; error?: string } {
  if (params === null || params === undefined) {
    return { valid: true };
  }

  if (!Array.isArray(params)) {
    return { valid: false, error: 'Parameters must be an array' };
  }

  const seen = new Set<string>();
  for (const param of params) {
    if (typeof param !== 'object' || param === null) {
      return { valid: false, error: 'Each parameter must be an object' };
    }
    const p = param as Record<string, unknown>;

    if (typeof p.name !== 'string' || p.name.trim().length === 0) {
      return {
        valid: false,
        error: 'Each parameter must have a non-empty string "name"',
      };
    }
    if (typeof p.type !== 'string' || p.type.trim().length === 0) {
      return {
        valid: false,
        error: `Parameter "${p.name}" must have a non-empty string "type"`,
      };
    }
    if (p.required !== undefined && typeof p.required !== 'boolean') {
      return {
        valid: false,
        error: `Parameter "${p.name}".required must be a boolean`,
      };
    }
    if (seen.has(p.name)) {
      return { valid: false, error: `Duplicate parameter name "${p.name}"` };
    }
    seen.add(p.name);
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Register a custom function.
 */
export async function create(
  data: CreateCustomFunctionInput,
): Promise<CustomFunction> {
  if (!validateFunctionType(data.functionType)) {
    throw new CustomFunctionValidationError(
      `Invalid function type. Must be one of: ${VALID_FUNCTION_TYPES.join(', ')}`,
    );
  }

  const paramValidation = validateParameters(data.parameters ?? null);
  if (!paramValidation.valid) {
    throw new CustomFunctionValidationError(
      `Invalid parameters: ${paramValidation.error}`,
    );
  }

  const [row] = await db
    .insert(customFunctions)
    .values({
      name: data.name,
      description: data.description ?? null,
      functionType: data.functionType,
      parameters: (data.parameters ?? null) as unknown as CustomFunction['parameters'],
      returnType: data.returnType ?? null,
    })
    .returning();

  return row as CustomFunction;
}

/**
 * Update a custom function.
 */
export async function update(
  id: string,
  data: UpdateCustomFunctionInput,
): Promise<CustomFunction | null> {
  const existing = await db
    .select()
    .from(customFunctions)
    .where(eq(customFunctions.id, id))
    .limit(1);
  if (!existing[0]) return null;

  if (data.functionType !== undefined && !validateFunctionType(data.functionType)) {
    throw new CustomFunctionValidationError(
      `Invalid function type. Must be one of: ${VALID_FUNCTION_TYPES.join(', ')}`,
    );
  }

  if (data.parameters !== undefined) {
    const paramValidation = validateParameters(data.parameters ?? null);
    if (!paramValidation.valid) {
      throw new CustomFunctionValidationError(
        `Invalid parameters: ${paramValidation.error}`,
      );
    }
  }

  const values: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };
  // Omit fields that should not be overwritten directly
  delete values.id;
  delete values.createdAt;

  const [row] = await db
    .update(customFunctions)
    .set(values)
    .where(eq(customFunctions.id, id))
    .returning();

  return row ?? null;
}

/**
 * Get a custom function by ID.
 */
export async function getById(id: string): Promise<CustomFunction | null> {
  const [row] = await db
    .select()
    .from(customFunctions)
    .where(and(eq(customFunctions.id, id), eq(customFunctions.isActive, true)))
    .limit(1);
  return row ?? null;
}

/**
 * List all active custom functions.
 */
export async function listAll(): Promise<CustomFunction[]> {
  return db
    .select()
    .from(customFunctions)
    .where(eq(customFunctions.isActive, true))
    .orderBy(customFunctions.name);
}

/**
 * Soft-delete a custom function (set isActive = false).
 */
export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(customFunctions)
    .set({ isActive: false })
    .where(eq(customFunctions.id, id))
    .returning({ id: customFunctions.id });

  return !!row;
}
