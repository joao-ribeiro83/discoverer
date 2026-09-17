import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isValidIdentifier } from '../lib/sql/identifiers.js';
import {
  create,
  update,
  getById,
  listAll,
  softDelete,
  CustomFunctionValidationError,
} from '../services/custom-function.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const FunctionTypeEnum = z.enum(['SQL', 'PLSQL', 'PACKAGE']);

const ParameterSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
  position: z.number().int().optional(),
});

// These parts go into generated SQL as `owner.package.name@link`, so each must
// be a plain identifier. A link may be dotted (`REMOTE.EXAMPLE.COM`).
const IdentifierSchema = z.string().max(128).refine(isValidIdentifier, 'Must be a plain SQL identifier');
const DbLinkSchema = z
  .string()
  .max(128)
  .refine((v) => v.split('.').every(isValidIdentifier), 'Must be a plain database link name');

const ReferenceSchema = {
  extOwner: IdentifierSchema.nullable().optional(),
  extPackage: IdentifierSchema.nullable().optional(),
  extName: IdentifierSchema.nullable().optional(),
  extDbLink: DbLinkSchema.nullable().optional(),
  dataSourceId: z.string().uuid().nullable().optional(),
};

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  functionType: FunctionTypeEnum,
  parameters: z.array(ParameterSchema).optional(),
  returnType: z.string().max(64).optional(),
  ...ReferenceSchema,
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  functionType: FunctionTypeEnum.optional(),
  parameters: z.array(ParameterSchema).nullable().optional(),
  returnType: z.string().max(64).nullable().optional(),
  ...ReferenceSchema,
});

const DsIdParamSchema = z.object({ dsId: z.string().uuid() });

const referenceJsonProperties = {
  extOwner: { type: ['string', 'null'], maxLength: 128 },
  extPackage: { type: ['string', 'null'], maxLength: 128 },
  extName: { type: ['string', 'null'], maxLength: 128 },
  extDbLink: { type: ['string', 'null'], maxLength: 128 },
  dataSourceId: { type: ['string', 'null'], format: 'uuid' },
} as const;

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const customFunctionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    functionType: { type: 'string', enum: ['SQL', 'PLSQL', 'PACKAGE'] },
    parameters: {},
    returnType: { type: ['string', 'null'] },
    // What SQL calls: extOwner.extPackage.extName@extDbLink. Set by migration.
    extOwner: { type: ['string', 'null'] },
    extPackage: { type: ['string', 'null'] },
    extName: { type: ['string', 'null'] },
    extDbLink: { type: ['string', 'null'] },
    dataSourceId: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: {},
  },
} as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default function customFunctionRoutes(fastify: FastifyInstance) {
  // All custom-function endpoints require authentication and ADMIN/MANAGER role.
  const adminManagerPreHandler = [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')];

  // GET /api/custom-functions — list all
  fastify.get(
    '/api/custom-functions',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: customFunctionSchema },
            },
          },
          401: errorResponse,
        },
      },
    },
    async (_request, reply) => {
      const list = await listAll();
      return reply.code(200).send({ data: list });
    },
  );

  // GET /api/custom-functions/:id — get one
  fastify.get(
    '/api/custom-functions/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: customFunctionSchema },
          },
          400: errorResponse,
          401: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid custom function ID format' });
      }

      const fn = await getById(parsed.data.id);
      if (!fn) {
        return reply.code(404).send({ error: 'Custom function not found' });
      }

      return reply.code(200).send({ data: fn });
    },
  );

  // POST /api/custom-functions — register
  fastify.post(
    '/api/custom-functions',
    {
      preHandler: adminManagerPreHandler,
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'functionType'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            functionType: { type: 'string', enum: ['SQL', 'PLSQL', 'PACKAGE'] },
            parameters: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string', minLength: 1 },
                  type: { type: 'string', minLength: 1 },
                  required: { type: 'boolean' },
                  defaultValue: {},
                  position: { type: 'integer' },
                },
              },
            },
            returnType: { type: 'string', maxLength: 64 },
            ...referenceJsonProperties,
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: customFunctionSchema },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = CreateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }

      try {
        const fn = await create(parsed.data);
        return reply.code(201).send({ data: fn });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof CustomFunctionValidationError) {
          return reply.code(400).send({ error: message, details: err.details });
        }
        throw err;
      }
    },
  );

  // PUT /api/custom-functions/:id — update
  fastify.put(
    '/api/custom-functions/:id',
    {
      preHandler: adminManagerPreHandler,
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'] },
            functionType: { type: 'string', enum: ['SQL', 'PLSQL', 'PACKAGE'] },
            parameters: {
              type: ['array', 'null'],
              items: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string', minLength: 1 },
                  type: { type: 'string', minLength: 1 },
                  required: { type: 'boolean' },
                  defaultValue: {},
                  position: { type: 'integer' },
                },
              },
            },
            returnType: { type: ['string', 'null'], maxLength: 64 },
            ...referenceJsonProperties,
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: customFunctionSchema },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid custom function ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        const fn = await update(paramParsed.data.id, bodyParsed.data);
        if (!fn) {
          return reply.code(404).send({ error: 'Custom function not found' });
        }

        return reply.code(200).send({ data: fn });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof CustomFunctionValidationError) {
          return reply.code(400).send({ error: message, details: err.details });
        }
        throw err;
      }
    },
  );

  // GET /api/data-sources/:dsId/functions — search the database for a function
  // to register. Read-only against ALL_ARGUMENTS.
  fastify.get(
    '/api/data-sources/:dsId/functions',
    {
      // Spelled out rather than reusing `adminManagerPreHandler`: SEC-03's scan
      // reads the registration block and only sees a gate it can name there.
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['dsId'],
          properties: { dsId: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          properties: {
            owner: { type: 'string', maxLength: 128 },
            search: { type: 'string', maxLength: 128 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  owner: { type: 'string' },
                  truncated: { type: 'boolean' },
                  functions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        owner: { type: 'string' },
                        packageName: { type: ['string', 'null'] },
                        name: { type: 'string' },
                        overload: { type: ['string', 'null'] },
                        returnType: { type: 'string' },
                        parameters: {},
                        callableFromSql: { type: 'boolean' },
                        reason: { type: ['string', 'null'] },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = DsIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid data source ID format' });
      }
      const { owner, search } = request.query as { owner?: string; search?: string };
      if (owner?.trim() && !isValidIdentifier(owner.trim())) {
        return reply.code(400).send({ error: 'Owner must be a plain SQL identifier' });
      }

      try {
        const { searchDatabaseFunctions } = await import('../services/oracle-introspection.js');
        const data = await searchDatabaseFunctions(parsed.data.dsId, { owner, search });
        return reply.code(200).send({ data });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Data source not found') {
          return reply.code(404).send({ error: message });
        }
        if (message.includes('only supported for Oracle')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // DELETE /api/custom-functions/:id — soft delete
  fastify.delete(
    '/api/custom-functions/:id',
    {
      preHandler: adminManagerPreHandler,
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'object', properties: { message: { type: 'string' } } },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid custom function ID format' });
      }

      const deleted = await softDelete(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Custom function not found' });
      }

      return reply.code(200).send({
        data: { message: 'Custom function deactivated' },
      });
    },
  );
}
