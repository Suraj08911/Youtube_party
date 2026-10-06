import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  connectTimeout: 20000,
  keepAlive: 10000,
  family: 4,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis retry limit reached');
      return null;
    }
    return Math.min(times * 200, 3000);
  },
};

// ⭐ Client — normal commands
export const redisClient = new Redis(env.REDIS_URL, baseOptions);

// ⭐ Pub client — for Socket.IO adapter
export const redisPubClient = new Redis(env.REDIS_URL, baseOptions);

// ⭐ Sub client — for Socket.IO adapter (MUST be separate)
export const redisSubClient = new Redis(env.REDIS_URL, baseOptions);

redisClient.on('error', (err) =>
  logger.error(`Redis [client] error: ${err.message}`)
);
redisPubClient.on('error', (err) =>
  logger.error(`Redis [pub] error: ${err.message}`)
);
redisSubClient.on('error', (err) =>
  logger.error(`Redis [sub] error: ${err.message}`)
);

export const initRedis = async (): Promise<void> => {
  const clients: Array<[string, Redis]> = [
    ['client', redisClient],
    ['pub', redisPubClient],
    ['sub', redisSubClient],
  ];

  const waitForReady = (name: string, client: Redis): Promise<void> =>
    new Promise((resolve, reject) => {
      if (client.status === 'ready') {
        logger.info(`✅ Redis ${name} already ready`);
        return resolve();
      }

      const onReady = () => {
        cleanup();
        logger.info(`✅ Redis ${name} ready`);
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(new Error(`Redis ${name} error: ${err.message}`));
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Redis ${name} timeout`));
      }, 20000);

      const cleanup = () => {
        clearTimeout(timer);
        client.off('ready', onReady);
        client.off('error', onError);
      };

      client.once('ready', onReady);
      client.once('error', onError);
    });

  try {
    await Promise.all(clients.map(([name, client]) => waitForReady(name, client)));
    logger.info('🎉 All Redis clients ready');
  } catch (err: any) {
    await Promise.allSettled([
      redisClient.quit(),
      redisPubClient.quit(),
      redisSubClient.quit(),
    ]);
    throw err;
  }
};

export const closeRedis = async (): Promise<void> => {
  await Promise.allSettled([
    redisClient.quit(),
    redisPubClient.quit(),
    redisSubClient.quit(),
  ]);
  logger.info('Redis connections closed');
};
