import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  SecurityPolicyError,
  assignPolicy,
  createPolicy,
  deletePolicy,
  getPolicy,
  listAssignments,
  listPolicies,
  removeAssignment,
  updatePolicy,
  validatePredicate,
} from '../services/security.service.js';
import { validateSql } from '../services/sql-generator.js';
import { previewSecuredSql } from '../lib/sql/security-predicates.js';
import { SqlGenerationError } from '../types/sql.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const RuleSchema = z.object({
  targetId: z.string().uuid(),
  targetType: z.enum(['BUSINESS_AREA', 'FOLDER']),
  sqlPredicate: z.string().min(1).max(4000),
});

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(4000).nullish(),
  isActive: z.boolean().optional(),
  rules: z.array(RuleSchema).min(1),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4000).nullish(),
  isActive: z.boolean().optional(),
  rules: z.array(RuleSchema).min(1).optional(),
});

const AssignBodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    roleName: z.enum(['ADMIN', 'MANAGER', 'USER', 'VIEWER']).optional(),
  })
  .refine((v) => (v.userId ? 1 : 0) + (v.roleName ? 1 : 0) === 1, {
    message: 'Provide exactly one of userId or roleName',
  });

const TestBodySchema = z
  .object({
    sql: z.string().min(1).max(20000),
    policyId: z.string().uuid().optional(),
    predicates: z.array(z.string().min(1).max(4000)).max(20).optional(),
  })
  .refine((v) => v.policyId ?? (v.predicates && v.predicates.length > 0), {
    message: 'Provide a policyId or at least one predicate',
  });

const IdParamSchema = z.object({ id: z.string().uuid() });
const AssignmentParamSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON response shapes (Fastify serialization / docs)
// ---------------------------------------------------------------------------

const ruleSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    policyId: { type: 'string' },
    targetId: { type: 'string' },
    targetType: { type: 'string', enum: ['BUSINESS_AREA', 'FOLDER'] },
    sqlPredicate: { type: 'string' },
    createdAt: { type: 'string' },
  },
} as const;

const policySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    policyType: { type: 'string' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
    ruleCount: { type: 'number' },
    assignmentCount: { type: 'number' },
    rules: { type: 'array', items: ruleSchema },
  },
} as const;

const assignmentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    policyId: { type: 'string' },
    userId: { type: 'string', nullable: true },
    roleName: { type: 'string', nullable: true },
    userEmail: { type: 'string', nullable: true },
    userName: { type: 'string', nullable: true },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: {},
  },
} as const;

function policyErrorStatus(err: SecurityPolicyError): 400 | 404 | 409 {
  switch (err.kind) {
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    default:
      return 400;
  }
}

// ---------------------------------------------------------------------------
// Routes — all admin-only: policies grant or deny access to DATA, so managing
// them is as sensitive as managing users.
// ---------------------------------------------------------------------------

export default async function securityRoutes(fastify: FastifyInstance) {
  const adminPreHandler = [fastify.authenticate, fastify.authorizeAdmin];
  const tags = ['Security'];
  const security = [{ bearerAuth: [] }];

  // GET /api/security/policies — list with rule/assignment counts
  fastify.get(
    '/api/security/policies',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'array', items: policySchema } },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (_request, reply) => {
      const rows = await listPolicies();
      return reply.code(200).send({ data: rows });
    },
  );

  // GET /api/security/policies/:id — one policy with its rules
  fastify.get(
    '/api/security/policies/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: { type: 'object', properties: { data: policySchema } },
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
        return reply.code(400).send({ error: 'Invalid policy ID format' });
      }
      const policy = await getPolicy(parsed.data.id);
      if (!policy) {
        return reply.code(404).send({ error: 'Policy not found' });
      }
      return reply.code(200).send({ data: policy });
    },
  );

  // POST /api/security/policies — create with rules
  fastify.post(
    '/api/security/policies',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          201: { type: 'object', properties: { data: policySchema } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
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
        const policy = await createPolicy(parsed.data);
        return await reply.code(201).send({ data: policy });
      } catch (err) {
        if (err instanceof SecurityPolicyError) {
          return reply.code(policyErrorStatus(err)).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // PUT /api/security/policies/:id — update (rules replaced when provided)
  fastify.put(
    '/api/security/policies/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: { type: 'object', properties: { data: policySchema } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid policy ID format' });
      }
      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }
      try {
        const policy = await updatePolicy(paramParsed.data.id, bodyParsed.data);
        if (!policy) {
          return reply.code(404).send({ error: 'Policy not found' });
        }
        return await reply.code(200).send({ data: policy });
      } catch (err) {
        if (err instanceof SecurityPolicyError) {
          return reply.code(policyErrorStatus(err)).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // DELETE /api/security/policies/:id
  fastify.delete(
    '/api/security/policies/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: { deleted: { type: 'boolean' } },
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
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid policy ID format' });
      }
      const deleted = await deletePolicy(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Policy not found' });
      }
      return reply.code(200).send({ data: { deleted: true } });
    },
  );

  // GET /api/security/policies/:id/assignments
  fastify.get(
    '/api/security/policies/:id/assignments',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'array', items: assignmentSchema } },
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
        return reply.code(400).send({ error: 'Invalid policy ID format' });
      }
      const policy = await getPolicy(parsed.data.id);
      if (!policy) {
        return reply.code(404).send({ error: 'Policy not found' });
      }
      const rows = await listAssignments(parsed.data.id);
      return reply.code(200).send({ data: rows });
    },
  );

  // POST /api/security/policies/:id/assignments — assign to user or role
  fastify.post(
    '/api/security/policies/:id/assignments',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          201: { type: 'object', properties: { data: assignmentSchema } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid policy ID format' });
      }
      const bodyParsed = AssignBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }
      try {
        const assignment = await assignPolicy(
          paramParsed.data.id,
          bodyParsed.data.userId,
          bodyParsed.data.roleName,
        );
        return await reply.code(201).send({ data: assignment });
      } catch (err) {
        if (err instanceof SecurityPolicyError) {
          return reply.code(policyErrorStatus(err)).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // DELETE /api/security/policies/:id/assignments/:assignmentId
  fastify.delete(
    '/api/security/policies/:id/assignments/:assignmentId',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: { deleted: { type: 'boolean' } },
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
      const parsed = AssignmentParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }
      const deleted = await removeAssignment(
        parsed.data.id,
        parsed.data.assignmentId,
      );
      if (!deleted) {
        return reply.code(404).send({ error: 'Assignment not found' });
      }
      return reply.code(200).send({ data: { deleted: true } });
    },
  );

  // POST /api/security/policies/test — preview predicates against a sample
  // query. Display-only: enforcement composes predicates inside the SQL
  // generator; this shows an admin where their predicates would land.
  fastify.post(
    '/api/security/policies/test',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  originalSql: { type: 'string' },
                  securedSql: { type: 'string' },
                  predicates: { type: 'array', items: { type: 'string' } },
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
      const parsed = TestBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }

      const sqlCheck = validateSql(parsed.data.sql);
      if (!sqlCheck.valid) {
        return reply
          .code(400)
          .send({ error: `Sample query: ${sqlCheck.error}` });
      }

      let predicates: string[];
      if (parsed.data.predicates && parsed.data.predicates.length > 0) {
        predicates = parsed.data.predicates;
      } else {
        const policy = await getPolicy(parsed.data.policyId!);
        if (!policy) {
          return reply.code(404).send({ error: 'Policy not found' });
        }
        predicates = policy.rules.map((r) => r.sqlPredicate);
      }

      // Ad-hoc predicates are validated here; stored rules were validated at
      // save time but re-checking is cheap and keeps the preview honest.
      for (const predicate of predicates) {
        const check = validatePredicate(predicate, { allowAliasToken: true });
        if (!check.valid) {
          return reply
            .code(400)
            .send({ error: `Invalid predicate: ${check.error}` });
        }
      }

      try {
        const securedSql = previewSecuredSql(parsed.data.sql, predicates);
        return await reply.code(200).send({
          data: {
            originalSql: parsed.data.sql,
            securedSql,
            predicates,
          },
        });
      } catch (err) {
        if (err instanceof SqlGenerationError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
