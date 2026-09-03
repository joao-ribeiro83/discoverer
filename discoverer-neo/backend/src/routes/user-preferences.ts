import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getPreferences,
  updatePreferences,
} from '../services/user-preferences.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const LOCALE_VALUES = ['en', 'pt-PT', 'fr-FR', 'es-ES'] as const;
const THEME_VALUES = ['light', 'dark', 'high-contrast'] as const;
const COLOR_PALETTE_VALUES = ['default', 'navy'] as const;

const UpdateBodySchema = z
  .object({
    locale: z.enum(LOCALE_VALUES).optional(),
    theme: z.enum(THEME_VALUES).optional(),
    colorPalette: z.enum(COLOR_PALETTE_VALUES).optional(),
  })
  .refine(
    (data) =>
      data.locale !== undefined || data.theme !== undefined || data.colorPalette !== undefined,
    {
      message: 'At least one of "locale", "theme", or "colorPalette" is required',
    },
  );

// ---------------------------------------------------------------------------
// JSON schema shapes
// ---------------------------------------------------------------------------

const preferencesSchema = {
  type: 'object',
  properties: {
    locale: { type: 'string', enum: LOCALE_VALUES },
    theme: { type: 'string', enum: THEME_VALUES },
    colorPalette: { type: 'string', enum: COLOR_PALETTE_VALUES },
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

export default async function userPreferencesRoutes(
  fastify: FastifyInstance,
) {
  // GET /api/users/me/preferences
  fastify.get(
    '/api/users/me/preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['User Preferences'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { data: preferencesSchema },
          },
          401: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const preferences = await getPreferences(user.sub);
      return reply.code(200).send({ data: preferences });
    },
  );

  // PATCH /api/users/me/preferences
  fastify.patch(
    '/api/users/me/preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['User Preferences'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            locale: { type: 'string', enum: LOCALE_VALUES },
            theme: { type: 'string', enum: THEME_VALUES },
            colorPalette: { type: 'string', enum: COLOR_PALETTE_VALUES },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: preferencesSchema },
          },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = UpdateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }

      const user = request.user!;
      const preferences = await updatePreferences(user.sub, parsed.data);
      return reply.code(200).send({ data: preferences });
    },
  );
}
