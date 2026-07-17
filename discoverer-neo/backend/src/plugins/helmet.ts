import fp from 'fastify-plugin';
import fastifyHelmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyHelmet);
}, { name: 'helmet' });
