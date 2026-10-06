import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/ApiError';
import { verifyToken } from '../../utils/jwt';

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed authorization header');
    }

    const token = header.slice(7);
    const payload = verifyToken(token);

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};