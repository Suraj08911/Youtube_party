import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { initRedis, closeRedis } from './config/redis';
import { initSocketServer } from './socket/socket.server';
import { logger } from './utils/logger';

const bootstrap = async (): Promise<void> => {
  try {
    logger.info('🚀 Starting Party Player backend...');

    // 1. Connect DBs
    await connectDB();
    await initRedis();

    // 2. Create Express app + HTTP server
    const app = createApp();
    const httpServer = http.createServer(app);

    // 3. Attach Socket.IO
    initSocketServer(httpServer);

    // 4. Listen
    httpServer.listen(env.PORT, () => {
      logger.info(`✅ Server running on http://localhost:${env.PORT}`);
      logger.info(`   Environment: ${env.NODE_ENV}`);
      logger.info(`   Client URL:  ${env.CLIENT_URL}`);
    });

    // ─── Graceful Shutdown ───
    const shutdown = async (signal: string) => {
      logger.warn(`\n⚠️  ${signal} received. Shutting down gracefully...`);

      httpServer.close(async () => {
        await disconnectDB();
        await closeRedis();
        logger.info('👋 Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        logger.error('⏰ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled Rejection: ${reason}`);
    });

    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err.message}`);
      process.exit(1);
    });
  } catch (err: any) {
    logger.error(`❌ Bootstrap failed: ${err.message}`);
    process.exit(1);
  }
};

bootstrap();