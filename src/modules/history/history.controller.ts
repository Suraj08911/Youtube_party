import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import * as historyService from './history.service';

export const getMyHistory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const history = await historyService.getHistory(req.user.userId);
  res.json({ success: true, data: history });
});