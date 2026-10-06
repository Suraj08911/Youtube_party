import mongoose from 'mongoose';
import { Room, DEFAULT_AUDIO_STATE } from '../../db/models/Room.model';
import { ApiError } from '../../utils/ApiError';
import { generateRoomCode } from '../../utils/generateCode';
import { logger } from '../../utils/logger';

interface CreateRoomInput {
  name: string;
  userId: string;
  username: string;
  playlist?: { label: string; videoId: string }[];
}

interface JoinRoomInput {
  code: string;
  userId: string;
  username: string;
}

const generateUniqueCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const exists = await Room.exists({ code });
    if (!exists) return code;
  }
  throw ApiError.internal('Could not generate unique room code');
};

export const createRoom = async (input: CreateRoomInput) => {
  const { name, userId, username, playlist = [] } = input;

  const seen = new Set<string>();
  const uniquePlaylist = playlist.filter((p) => {
    if (seen.has(p.videoId)) return false;
    seen.add(p.videoId);
    return true;
  });

  const code = await generateUniqueCode();
  const firstVideo =
    uniquePlaylist.length > 0 ? uniquePlaylist[0].videoId : null;

  const room = await Room.create({
    code,
    name: name.trim(),
    hostId: new mongoose.Types.ObjectId(userId),
    audioState: { ...DEFAULT_AUDIO_STATE },
    playlist: uniquePlaylist.map((p) => ({ ...p, addedAt: new Date() })),
    videoId: firstVideo,
    playState: 'paused',
    currentTime: 0,
    lastSyncAt: Date.now(),
    hostOnline: true,
    isActive: true,
    participants: [
      {
        userId: new mongoose.Types.ObjectId(userId),
        username,
        role: 'host',
        joinedAt: new Date(),
      },
    ],
  });

  logger.info(
    `🏠 Room created: ${room.code} by ${username} (${uniquePlaylist.length} videos)`
  );
  return room;
};

export const joinRoom = async (input: JoinRoomInput) => {
  const { code, userId, username } = input;

  const room = await Room.findOne({ code: code.toUpperCase() });

  if (!room) {
    throw ApiError.notFound(
      'Room not found. It may have been closed by the host.'
    );
  }

  const existing = room.participants.find(
    (p) => p.userId.toString() === userId
  );

  if (existing) {
    logger.info(
      `🔄 ${username} rejoined room ${room.code} as ${existing.role}`
    );

    if (!room.isActive) {
      room.isActive = true;
      await room.save();
    }

    return room;
  }

  if (room.participants.length >= 50) {
    throw ApiError.forbidden('Room is full (max 50 participants)');
  }

  room.participants.push({
    userId: new mongoose.Types.ObjectId(userId),
    username,
    role: 'participant',
    joinedAt: new Date(),
  });

  await room.save();
  logger.info(`👤 ${username} joined room ${room.code} as participant`);
  return room;
};

export const getRoomByCode = async (code: string) => {
  const room = await Room.findOne({ code: code.toUpperCase() }).lean();
  if (!room) throw ApiError.notFound('Room not found');
  return room;
};

export const getUserRooms = async (userId: string) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const rooms = await Room.find({
    'participants.userId': userObjectId,
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return rooms.map((r) => {
    const userParticipant = r.participants.find(
      (p) => p.userId.toString() === userId
    );
    const userRole = userParticipant?.role || 'participant';
    const hostParticipant = r.participants.find((p) => p.role === 'host');
    const isHost = userRole === 'host' || r.hostId.toString() === userId;

    return {
      _id: r._id.toString(),
      code: r.code,
      name: r.name,
      isActive: r.isActive,
      hostOnline: r.hostOnline,
      isOnline: r.isActive === true,
      userRole,
      isHost,
      hostId: r.hostId.toString(),
      host: hostParticipant?.username || 'Unknown',
      videoId: r.videoId,
      playlistCount: r.playlist?.length || 0,
      participantCount: r.participants?.length || 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
};

export const deleteRoom = async (roomId: string, userId: string) => {
  const room = await Room.findById(roomId);
  if (!room) throw ApiError.notFound('Room not found');
  if (room.hostId.toString() !== userId) {
    throw ApiError.forbidden('Only host can delete the room');
  }

  await Room.deleteOne({ _id: roomId });
  logger.info(`🗑️ Room ${room.code} permanently deleted by host`);
  return room;
};

export const deactivateRoom = deleteRoom;