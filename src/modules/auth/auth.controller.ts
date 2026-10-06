import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { registerSchema, loginSchema } from './auth.validation';
import * as authService from './auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  }

  const result = await authService.registerUser(parsed.data);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  }

  const result = await authService.loginUser(parsed.data);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const user = await authService.getCurrentUser(req.user.userId);

  res.status(200).json({
    success: true,
    data: { user },
  });
});
