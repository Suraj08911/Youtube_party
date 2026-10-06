import { Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice(7)
        : null);

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);

    socket.user = {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
    };

    logger.debug(`🔐 Socket auth OK: ${payload.username}`);
    next();
  } catch (err: any) {
    logger.warn(`❌ Socket auth failed: ${err.message}`);
    next(new Error('Invalid token'));
  }
};