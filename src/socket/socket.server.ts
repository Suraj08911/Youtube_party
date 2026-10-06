import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { corsOptions } from '../config/cors';
import { redisPubClient, redisSubClient } from '../config/redis';
import { socketAuthMiddleware } from './socket.auth';
import { registerJoinRoomHandlers } from './handlers/joinRoom.handler';
import { registerPlaybackHandlers } from './handlers/playback.handler';
import { registerRoleHandlers } from './handlers/role.handler';
import { registerAudioHandlers } from './handlers/audio.handler';
import { registerChatHandlers } from './handlers/chat.handler';
import { startChatFlusher } from './handlers/chat.flusher';
import { logger } from '../utils/logger';

export const initSocketServer = (httpServer: HttpServer): SocketServer => {
  const io = new SocketServer(httpServer, {
    cors: corsOptions,
    // ⭐ WebSocket only — NO polling (fastest)
    transports: ['websocket'],
    // ⭐ Low latency settings
    pingTimeout: 20000,
    pingInterval: 10000,
    upgradeTimeout: 5000,
    // ⭐ Compression off — reduces CPU + latency
    perMessageDeflate: false,
    // ⭐ High throughput
    maxHttpBufferSize: 1e6,
    // ⭐ Allow binary
    allowEIO3: false,
  });

  // ⭐ Scalable Redis Adapter (multi-server sync)
  io.adapter(
    createAdapter(redisPubClient, redisSubClient, {
      // ⭐ Faster key expiry check
      requestsTimeout: 5000,
      // ⭐ Publish on room join/leave
      publishOnSpecificResponseChannel: false,
    })
  );

  logger.info('✅ Socket.IO Redis adapter attached (scalable mode)');

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket: ${socket.id} (${socket.user?.username})`);

    registerJoinRoomHandlers(io, socket);
    registerPlaybackHandlers(io, socket);
    registerRoleHandlers(io, socket);
    registerAudioHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info(`🔌 Disconnected: ${socket.id}`);
    });
  });

  // ⭐ Start background chat flusher
  startChatFlusher();

  logger.info('✅ Socket.IO initialized (scalable + low latency)');
  return io;
};
