import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { corsOptions } from './config/cors';
import { ApiError } from './utils/ApiError';
import authRoutes from './modules/auth/auth.routes';
import roomRoutes from './modules/room/room.routes';
import historyRoutes from './modules/history/history.routes';
import playlistRoutes from './modules/playlist/playlist.routes';

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.IS_PROD) app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/playlists', playlistRoutes);

  app.use((req, _res, next) => {
    next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    if (statusCode >= 500) console.error('🔥 Server error:', err);
    res.status(statusCode).json({
      success: false,
      message,
      ...(env.IS_PROD ? {} : { stack: err.stack }),
    });
  });

  return app;
};
