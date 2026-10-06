import mongoose from 'mongoose';
import { Playlist } from '../../db/models/Playlist.model';
import { ApiError } from '../../utils/ApiError';

// ⭐ LIST — latest on top
export const getUserPlaylists = async (userId: string) => {
  return Playlist.find({ userId })
    .sort({ updatedAt: -1 })
    .lean();
};

// ⭐ GET ONE
export const getPlaylistById = async (userId: string, playlistId: string) => {
  const playlist = await Playlist.findOne({
    _id: new mongoose.Types.ObjectId(playlistId),
    userId,
  }).lean();

  if (!playlist) throw ApiError.notFound('Playlist not found');
  return playlist;
};

// ⭐ CREATE
export const createPlaylist = async (
  userId: string,
  name: string,
  items: { label: string; videoId: string }[] = []
) => {
  return Playlist.create({
    userId,
    name,
    items: items.map((i) => ({ ...i, addedAt: new Date() })),
  });
};

// ⭐ UPDATE
export const updatePlaylist = async (
  userId: string,
  playlistId: string,
  updates: { name?: string; items?: { label: string; videoId: string }[] }
) => {
  const playlist = await Playlist.findOne({
    _id: new mongoose.Types.ObjectId(playlistId),
    userId,
  });

  if (!playlist) throw ApiError.notFound('Playlist not found');

  if (updates.name) playlist.name = updates.name;
  if (updates.items) {
    playlist.items = updates.items.map((i) => ({
      ...i,
      addedAt: new Date(),
    }));
  }

  await playlist.save();
  return playlist;
};

// ⭐ DELETE
export const deletePlaylist = async (userId: string, playlistId: string) => {
  const res = await Playlist.deleteOne({
    _id: new mongoose.Types.ObjectId(playlistId),
    userId,
  });

  if (res.deletedCount === 0) throw ApiError.notFound('Playlist not found');
};

// ⭐ ADD SINGLE ITEM
export const addItemToPlaylist = async (
  userId: string,
  playlistId: string,
  item: { label: string; videoId: string }
) => {
  const playlist = await Playlist.findOne({
    _id: new mongoose.Types.ObjectId(playlistId),
    userId,
  });

  if (!playlist) throw ApiError.notFound('Playlist not found');

  const exists = playlist.items.some((i) => i.videoId === item.videoId);
  if (exists) throw ApiError.conflict('Video already in playlist');

  playlist.items.push({
    label: item.label,
    videoId: item.videoId,
    addedAt: new Date(),
  });

  await playlist.save();
  return playlist;
};