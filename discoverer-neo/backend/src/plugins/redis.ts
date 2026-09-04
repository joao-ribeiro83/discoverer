import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp((fastify) => {
  const redis = new Redis(config.REDIS_URL);

  redis.on('error', (err) => {
    fastify.log.error({ err }, 'Redis connection error');
  });

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
}, { name: 'redis' });
