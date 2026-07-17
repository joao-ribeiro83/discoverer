import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  listByBusinessArea,
  listByDataSource,
  softDelete,
  importFromOracle,
  validateCustomSql,
} from '../services/folder.service.js';
import {
  requireBusinessAreaAccess,
  requireFolderAccess,
} from '../middleware/business-area-auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const FolderTypeEnum = z.enum(['TABLE', 'VIEW', 'DERIVED', 'COMPLEX', 'JOIN', 'SUMMARY']);

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  folderType: FolderTypeEnum,
  tableName: z.string().max(255).optional(),
  tableOwner: z.string().max(255).optional(),
  customSql: z.string().optional(),
  dataSourceId: z.string().uuid().optional(),
  displayOrder: z.number().int().optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  folderType: FolderTypeEnum.optional(),
  tableName: z.string().max(255).nullable().optional(),
  tableOwner: z.string().max(255).nullable().optional(),
  customSql: z.string().nullable().optional(),
  dataSourceId: z.string().uuid().nullable().optional(),
  displayOrder: z.number().int().optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const BaIdParamSchema = z.object({
  baId: z.string().uuid(),
});

const DsIdParamSchema = z.object({
  dsId: z.string().uuid(),
});

const ImportBodySchema = z.object({
  tableNames: z.array(z.string().min(1)).min(1),
  tableOwner: z.string().min(1),
  businessAreaId: z.string().uuid(),
});

const IntrospectQuerySchema = z.object({
  tableOwner: z.string().optional(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const folderSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    businessAreaId: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    folderType: { type: 'string', enum: ['TABLE', 'VIEW', 'DERIVED', 'COMPLEX', 'JOIN', 'SUMMARY'] },
    tableName: { type: ['string', 'null'] },
    tableOwner: { type: ['string', 'null'] },
    customSql: { type: ['string', 'null'] },
    dataSourceId: { type: ['string', 'null'] },
    displayOrder: { type: 'integer' },
    isActive: { type: 'boolean' },
    createdBy: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    dataSourceName: { type: ['string', 'null'] },
  },
} as const;

const introspectedColumnSchema = {
  type: 'object',
  properties: {
    columnName: { type: 'string' },
    dataType: { type: 'string' },
    dataLength: { type: ['integer', 'null'] },
    nullable: { type: 'boolean' },
  },
} as const;

const introspectedTableSchema = {
  type: 'object',
  properties: {
    tableName: { type: 'string' },
    tableOwner: { type: 'string' },
    columns: { type: 'array', items: introspectedColumnSchema },
  },
} as const;

const importResultSchema = {
  type: 'object',
  properties: {
    created: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          folderId: { type: 'string' },
          name: { type: 'string' },
          tableName: { type: 'string' },
        },
      },
    },
    skipped: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tableName: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function folderRoutes(fastify: FastifyInstance) {
  // GET /api/business-areas/:baId/folders — list folders in a business area
  fastify.get(
    '/api/business-areas/:baId/folders',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Folders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: folderSchema },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = BaIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid business area ID format' });
      }

      const folderList = await listByBusinessArea(parsed.data.baId);
      return reply.code(200).send({ data: folderList });
    },
  );

  // GET /api/folders/:id — get one folder
  fastify.get(
    '/api/folders/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Folders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: folderSchema },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid folder ID format' });
      }

      const folder = await getById(parsed.data.id);
      if (!folder) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      return reply.code(200).send({ data: folder });
    },
  );

  // POST /api/business-areas/:baId/folders — create folder
  fastify.post(
    '/api/business-areas/:baId/folders',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('CREATE')],
      schema: {
        tags: ['Folders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['name', 'folderType'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            folderType: { type: 'string', enum: ['TABLE', 'VIEW', 'DERIVED', 'COMPLEX', 'JOIN', 'SUMMARY'] },
            tableName: { type: 'string', maxLength: 255 },
            tableOwner: { type: 'string', maxLength: 255 },
            customSql: { type: 'string' },
            dataSourceId: { type: 'string', format: 'uuid' },
            displayOrder: { type: 'integer' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: folderSchema },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const paramParsed = BaIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid business area ID format' });
      }

      const bodyParsed = CreateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      const user = request.user!;

      try {
        const folder = await create(
          {
            businessAreaId: paramParsed.data.baId,
            name: bodyParsed.data.name,
            description: bodyParsed.data.description,
            folderType: bodyParsed.data.folderType,
            tableName: bodyParsed.data.tableName,
            tableOwner: bodyParsed.data.tableOwner,
            customSql: bodyParsed.data.customSql,
            dataSourceId: bodyParsed.data.dataSourceId,
            displayOrder: bodyParsed.data.displayOrder,
            createdBy: user.sub,
          },
          fastify.redis,
        );

        return reply.code(201).send({ data: folder });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('does not exist') || message.includes('Invalid custom SQL')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // PUT /api/folders/:id — update folder
  fastify.put(
    '/api/folders/:id',
    {
      preHandler: [fastify.authenticate, requireFolderAccess('EDIT')],
      schema: {
        tags: ['Folders'],
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
            folderType: { type: 'string', enum: ['TABLE', 'VIEW', 'DERIVED', 'COMPLEX', 'JOIN', 'SUMMARY'] },
            tableName: { type: ['string', 'null'] },
            tableOwner: { type: ['string', 'null'] },
            customSql: { type: ['string', 'null'] },
            dataSourceId: { type: ['string', 'null'] },
            displayOrder: { type: 'integer' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: folderSchema },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: {
            type: 'object',
            properties: { error: { type: 'string' }, details: { type: 'string' } },
          },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid folder ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      const folder = await update(paramParsed.data.id, bodyParsed.data);
      if (!folder) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      return reply.code(200).send({ data: folder });
    },
  );

  // DELETE /api/folders/:id — soft delete
  fastify.delete(
    '/api/folders/:id',
    {
      preHandler: [fastify.authenticate, requireFolderAccess('DELETE')],
      schema: {
        tags: ['Folders'],
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
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: {
            type: 'object',
            properties: { error: { type: 'string' }, details: { type: 'string' } },
          },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid folder ID format' });
      }

      const deleted = await softDelete(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      return reply.code(200).send({
        data: { message: 'Folder deactivated' },
      });
    },
  );

  // POST /api/data-sources/:dsId/introspect — trigger Oracle introspection
  fastify.post(
    '/api/data-sources/:dsId/introspect',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Folders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['dsId'],
          properties: { dsId: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          properties: {
            tableOwner: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  tables: { type: 'array', items: introspectedTableSchema },
                  count: { type: 'integer' },
                  cached: { type: 'boolean' },
                },
              },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const paramParsed = DsIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid data source ID format' });
      }

      const queryParsed = IntrospectQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply.code(400).send({ error: 'Invalid query parameters' });
      }

      try {
        const { introspectSchema, invalidateCache } = await import('../services/oracle-introspection.js');

        // Invalidate cache to force fresh introspection
        await invalidateCache(fastify.redis, paramParsed.data.dsId);

        const tables = await introspectSchema(paramParsed.data.dsId, fastify.redis);

        return reply.code(200).send({
          data: {
            tables,
            count: tables.length,
            cached: false,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Data source not found') {
          return reply.code(404).send({ error: 'Data source not found' });
        }
        if (message.includes('only supported for Oracle')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // GET /api/data-sources/:dsId/tables — list available Oracle tables
  fastify.get(
    '/api/data-sources/:dsId/tables',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Folders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['dsId'],
          properties: { dsId: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          properties: {
            tableOwner: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  tables: { type: 'array', items: introspectedTableSchema },
                  count: { type: 'integer' },
                },
              },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const paramParsed = DsIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid data source ID format' });
      }

      try {
        const { introspectSchema } = await import('../services/oracle-introspection.js');
        const tables = await introspectSchema(paramParsed.data.dsId, fastify.redis);

        return reply.code(200).send({
          data: {
            tables,
            count: tables.length,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Data source not found') {
          return reply.code(404).send({ error: 'Data source not found' });
        }
        if (message.includes('only supported for Oracle')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // POST /api/data-sources/:dsId/import — import tables as folders
  fastify.post(
    '/api/data-sources/:dsId/import',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Folders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['dsId'],
          properties: { dsId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['tableNames', 'tableOwner', 'businessAreaId'],
          properties: {
            tableNames: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              minItems: 1,
            },
            tableOwner: { type: 'string', minLength: 1 },
            businessAreaId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: importResultSchema,
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const paramParsed = DsIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid data source ID format' });
      }

      const bodyParsed = ImportBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      const user = request.user!;

      try {
        const result = await importFromOracle(
          paramParsed.data.dsId,
          bodyParsed.data.tableNames,
          bodyParsed.data.tableOwner,
          bodyParsed.data.businessAreaId,
          user.sub,
          fastify.redis,
        );

        return reply.code(200).send({ data: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Data source not found') {
          return reply.code(404).send({ error: 'Data source not found' });
        }
        if (message.includes('only supported for Oracle')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );
}
