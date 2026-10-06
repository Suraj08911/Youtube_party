import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisPubClient, redisSubClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * This adapter lets multiple Socket.IO server instances
 * communicate via Redis Pub/Sub.
 *
 * Even with a single server, it's useful because it
 * lets you scale horizontally later without changing code.
 */
export const attachRedisAdapter = (io: Server): void => {
  io.adapter(createAdapter(redisPubClient, redisSubClient));
  logger.info('✅ Socket.IO Redis adapter attached');
};