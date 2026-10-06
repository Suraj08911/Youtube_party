import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers so we don't need try/catch in every controller.
 * Any thrown error goes to Express error middleware.
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};