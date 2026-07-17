import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });
}, { name: 'cors' });
