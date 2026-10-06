import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import * as playlistService from './playlist.service';

// ⭐ LIST — sirf is user ki playlists
export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const playlists = await playlistService.getUserPlaylists(req.user.userId);

  res.json({ success: true, data: { playlists } });
});

// ⭐ CREATE — user ke ID pe save
export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { name, items } = req.body;
  if (!name || !Array.isArray(items)) {
    throw ApiError.badRequest('name and items required');
  }

  const playlist = await playlistService.createPlaylist(
    req.user.userId,
    name,
    items
  );

  res.status(201).json({ success: true, data: { playlist } });
});

// GET ONE
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id;
  if (typeof id !== 'string') throw ApiError.badRequest('Invalid playlist ID');

  const playlist = await playlistService.getPlaylistById(
    req.user.userId,
    id
  );

  res.json({ success: true, data: { playlist } });
});

// UPDATE
export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id;
  if (typeof id !== 'string') throw ApiError.badRequest('Invalid playlist ID');

  const playlist = await playlistService.updatePlaylist(
    req.user.userId,
    id,
    req.body
  );

  res.json({ success: true, data: { playlist } });
});

// DELETE
export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id;
  if (typeof id !== 'string') throw ApiError.badRequest('Invalid playlist ID');

  await playlistService.deletePlaylist(req.user.userId, id);

  res.json({ success: true, message: 'Deleted' });
});

// ⭐ ADD ITEM
export const addItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id;
  if (typeof id !== 'string') throw ApiError.badRequest('Invalid playlist ID');

  const { label, videoId } = req.body;
  if (!videoId) throw ApiError.badRequest('videoId required');

  const playlist = await playlistService.addItemToPlaylist(
    req.user.userId,
    id,
    { label: label || videoId, videoId }
  );

  res.json({ success: true, data: { playlist } });
});
