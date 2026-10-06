import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { createRoomSchema, joinRoomSchema } from './room.validation';
import * as roomService from './room.service';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success)
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const room = await roomService.createRoom({
    name: parsed.data.name,
    playlist: parsed.data.playlist,
    userId: req.user.userId,
    username: req.user.username,
  });

  res
    .status(201)
    .json({ success: true, message: 'Room created', data: { room } });
});

export const join = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const parsed = joinRoomSchema.safeParse(req.body);
  if (!parsed.success)
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');

  const room = await roomService.joinRoom({
    code: parsed.data.code,
    userId: req.user.userId,
    username: req.user.username,
  });

  res.json({ success: true, message: 'Joined room', data: { room } });
});

export const getByCode = asyncHandler(async (req: Request, res: Response) => {
  const code = req.params.code;
  if (typeof code !== 'string') throw ApiError.badRequest('Invalid room code');
  const room = await roomService.getRoomByCode(code);
  res.json({ success: true, data: { room } });
});

export const myRooms = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const rooms = await roomService.getUserRooms(req.user.userId);
  res.json({ success: true, data: { rooms } });
});

export const close = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const id = req.params.id;
  if (typeof id !== 'string') throw ApiError.badRequest('Invalid room ID');
  const room = await roomService.deleteRoom(id, req.user.userId);

  res.json({
    success: true,
    message: 'Room permanently closed',
    data: { room },
  });
});
