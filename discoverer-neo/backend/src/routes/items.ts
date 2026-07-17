import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  listByFolder,
  listByBusinessArea,
  softDelete,
  importFromOracleColumns,
  validateFormula,
  getDescendants,
} from '../services/item.service.js';
import { requireFolderAccess, requireItemAccess } from '../middleware/business-area-auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const ItemTypeEnum = z.enum(['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU']);

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  itemType: ItemTypeEnum,
  columnName: z.string().max(255).optional(),
  formula: z.string().optional(),
  dataType: z.string().max(64).optional(),
  formatMask: z.string().max(255).optional(),
  aggFunction: z.string().max(64).optional(),
  displayOrder: z.number().int().optional(),
  isHidden: z.boolean().optional(),
  parentItemId: z.string().uuid().nullable().optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  itemType: ItemTypeEnum.optional(),
  columnName: z.string().max(255).nullable().optional(),
  formula: z.string().nullable().optional(),
  dataType: z.string().max(64).nullable().optional(),
  formatMask: z.string().max(255).nullable().optional(),
  aggFunction: z.string().max(64).nullable().optional(),
  displayOrder: z.number().int().optional(),
  isHidden: z.boolean().optional(),
  parentItemId: z.string().uuid().nullable().optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const FolderIdParamSchema = z.object({
  folderId: z.string().uuid(),
});

const ImportBodySchema = z.object({
  columns: z
    .array(
      z.object({
        columnName: z.string().min(1),
        dataType: z.string().min(1),
        dataLength: z.number().int().nullable().optional(),
        nullable: z.boolean().optional(),
      }),
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const itemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    folderId: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    itemType: { type: 'string', enum: ['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU'] },
    columnName: { type: ['string', 'null'] },
    formula: { type: ['string', 'null'] },
    dataType: { type: ['string', 'null'] },
    formatMask: { type: ['string', 'null'] },
    aggFunction: { type: ['string', 'null'] },
    displayOrder: { type: 'integer' },
    isHidden: { type: 'boolean' },
    isActive: { type: 'boolean' },
    parentItemId: { type: ['string', 'null'] },
    createdBy: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
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
          itemId: { type: 'string' },
          name: { type: 'string' },
          columnName: { type: 'string' },
        },
      },
    },
    skipped: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          columnName: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function itemRoutes(fastify: FastifyInstance) {
  // GET /api/folders/:folderId/items — list items in a folder
  fastify.get(
    '/api/folders/:folderId/items',
    {
      preHandler: [fastify.authenticate, requireFolderAccess('VIEW')],
      schema: {
        tags: ['Items'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['folderId'],
          properties: { folderId: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: itemSchema },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = FolderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid folder ID format' });
      }

      const itemList = await listByFolder(parsed.data.folderId);
      return reply.code(200).send({ data: itemList });
    },
  );

  // GET /api/items/:id — get one item
  fastify.get(
    '/api/items/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Items'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: itemSchema },
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
        return reply.code(400).send({ error: 'Invalid item ID format' });
      }

      const item = await getById(parsed.data.id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      return reply.code(200).send({ data: item });
    },
  );

  // POST /api/folders/:folderId/items — create item
  fastify.post(
    '/api/folders/:folderId/items',
    {
      preHandler: [fastify.authenticate, requireFolderAccess('CREATE')],
      schema: {
        tags: ['Items'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['folderId'],
          properties: { folderId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['name', 'itemType'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            itemType: { type: 'string', enum: ['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU'] },
            columnName: { type: 'string', maxLength: 255 },
            formula: { type: 'string' },
            dataType: { type: 'string', maxLength: 64 },
            formatMask: { type: 'string', maxLength: 255 },
            aggFunction: { type: 'string', maxLength: 64 },
            displayOrder: { type: 'integer' },
            isHidden: { type: 'boolean' },
            parentItemId: { type: ['string', 'null'], format: 'uuid' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: itemSchema },
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
      const paramParsed = FolderIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid folder ID format' });
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
        const item = await create({
          folderId: paramParsed.data.folderId,
          name: bodyParsed.data.name,
          description: bodyParsed.data.description,
          itemType: bodyParsed.data.itemType,
          columnName: bodyParsed.data.columnName,
          formula: bodyParsed.data.formula,
          dataType: bodyParsed.data.dataType,
          formatMask: bodyParsed.data.formatMask,
          aggFunction: bodyParsed.data.aggFunction,
          displayOrder: bodyParsed.data.displayOrder,
          isHidden: bodyParsed.data.isHidden,
          parentItemId: bodyParsed.data.parentItemId,
          createdBy: user.sub,
        });

        return reply.code(201).send({ data: item });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('required') ||
          message.includes('Invalid formula') ||
          message.includes('does not exist')
        ) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // PUT /api/items/:id — update item
  fastify.put(
    '/api/items/:id',
    {
      preHandler: [fastify.authenticate, requireItemAccess('EDIT')],
      schema: {
        tags: ['Items'],
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
            itemType: { type: 'string', enum: ['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU'] },
            columnName: { type: ['string', 'null'], maxLength: 255 },
            formula: { type: ['string', 'null'] },
            dataType: { type: ['string', 'null'], maxLength: 64 },
            formatMask: { type: ['string', 'null'], maxLength: 255 },
            aggFunction: { type: ['string', 'null'], maxLength: 64 },
            displayOrder: { type: 'integer' },
            isHidden: { type: 'boolean' },
            parentItemId: { type: ['string', 'null'], format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: itemSchema },
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
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid item ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        const item = await update(paramParsed.data.id, bodyParsed.data);
        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        return reply.code(200).send({ data: item });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('Invalid formula')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // DELETE /api/items/:id — soft delete
  fastify.delete(
    '/api/items/:id',
    {
      preHandler: [fastify.authenticate, requireItemAccess('DELETE')],
      schema: {
        tags: ['Items'],
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
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid item ID format' });
      }

      const deleted = await softDelete(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      return reply.code(200).send({
        data: { message: 'Item deactivated' },
      });
    },
  );

  // POST /api/folders/:folderId/items/import — import from Oracle columns
  fastify.post(
    '/api/folders/:folderId/items/import',
    {
      preHandler: [fastify.authenticate, requireFolderAccess('CREATE')],
      schema: {
        tags: ['Items'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['folderId'],
          properties: { folderId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['columns'],
          properties: {
            columns: {
              type: 'array',
              items: {
                type: 'object',
                required: ['columnName', 'dataType'],
                properties: {
                  columnName: { type: 'string', minLength: 1 },
                  dataType: { type: 'string', minLength: 1 },
                  dataLength: { type: ['integer', 'null'] },
                  nullable: { type: 'boolean' },
                },
              },
              minItems: 1,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: importResultSchema },
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
      const paramParsed = FolderIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid folder ID format' });
      }

      const bodyParsed = ImportBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        const result = await importFromOracleColumns(
          paramParsed.data.folderId,
          bodyParsed.data.columns,
        );

        return reply.code(200).send({ data: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('does not exist')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // GET /api/items/:id/descendants — get hierarchical descendants
  fastify.get(
    '/api/items/:id/descendants',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Items'],
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
              data: { type: 'array', items: itemSchema },
            },
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
        return reply.code(400).send({ error: 'Invalid item ID format' });
      }

      try {
        const descendants = await getDescendants(parsed.data.id);
        return reply.code(200).send({ data: descendants });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('does not exist')) {
          return reply.code(404).send({ error: message });
        }
        throw err;
      }
    },
  );
}
