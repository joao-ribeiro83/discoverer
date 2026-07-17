import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

export default fp(
  async function swaggerPlugin(app: FastifyInstance) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Discoverer Neo API',
          description:
            'REST API for Oracle Discoverer Neo metadata management backend. ' +
            'Manage data sources, business areas, folders, items, joins, hierarchies, and custom functions.',
          version: '0.1.0',
          contact: {
            name: 'Discoverer Neo',
          },
        },
        servers: [
          {
            url: 'http://localhost:3000',
            description: 'Local development',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT token returned by POST /api/auth/login',
            },
          },
        },
        tags: [
          { name: 'Health', description: 'Service health checks' },
          { name: 'Auth', description: 'Authentication and authorization' },
          { name: 'Data Sources', description: 'Oracle / Postgres data source management' },
          { name: 'Business Areas', description: 'Business area management and grants' },
          { name: 'Folders', description: 'Folder CRUD and Oracle introspection' },
          { name: 'Items', description: 'Item CRUD, import, and hierarchies' },
          { name: 'Joins', description: 'Join CRUD and auto-suggestions' },
          { name: 'Hierarchies', description: 'Hierarchy CRUD and level management' },
          { name: 'Custom Functions', description: 'Custom SQL/PLSQL function management' },
        ],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayOperationId: false,
      },
      staticCSP: true,
      transformStaticCSP: (header: string) => header,
    });
  },
  { name: 'swagger' },
);
