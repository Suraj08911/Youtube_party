import mongoose from 'mongoose';
import { RoomHistory } from '../../db/models/RoomHistory.model';
import { Role } from '../../db/models/Room.model';

interface RecordJoinInput {
  userId: string;
  username: string;
  roomId: string;
  roomCode: string;
  roomName: string;
  role: Role;
  totalMembers: number;
  hostUsername: string;
}

export const recordJoin = async (input: RecordJoinInput) => {
  const {
    userId,
    username,
    roomId,
    roomCode,
    roomName,
    role,
    totalMembers,
    hostUsername,
  } = input;

  let history = await RoomHistory.findOne({ userId });

  if (!history) {
    history = await RoomHistory.create({
      userId,
      username,
      entries: [],
      stats: {
        hostCount: 0,
        moderatorCount: 0,
        participantCount: 0,
        viewerCount: 0,
        totalRooms: 0,
        totalWatchTime: 0,
      },
    });
  }

  history.entries.push({
    roomId: new mongoose.Types.ObjectId(roomId),
    roomCode,
    roomName,
    joinedAt: new Date(),
    leftAt: null,
    duration: 0,
    role,
    totalMembers,
    hostUsername,
  });

  if (role === 'host') history.stats.hostCount += 1;
  else if (role === 'moderator') history.stats.moderatorCount += 1;
  else if (role === 'viewer') history.stats.viewerCount += 1;
  else history.stats.participantCount += 1;

  history.stats.totalRooms += 1;

  await history.save();
  return history;
};

export const recordLeave = async (userId: string, roomId: string) => {
  const history = await RoomHistory.findOne({ userId });
  if (!history) return;

  const entry = [...history.entries]
    .reverse()
    .find((e) => e.roomId.toString() === roomId && !e.leftAt);

  if (entry) {
    entry.leftAt = new Date();
    entry.duration = Math.floor(
      (entry.leftAt.getTime() - entry.joinedAt.getTime()) / 1000
    );
    history.stats.totalWatchTime += entry.duration;
    await history.save();
  }
};

export const getHistory = async (userId: string) => {
  const history = await RoomHistory.findOne({ userId }).lean();

  if (!history) {
    return {
      entries: [],
      stats: {
        hostCount: 0,
        moderatorCount: 0,
        participantCount: 0,
        viewerCount: 0,
        totalRooms: 0,
        totalWatchTime: 0,
      },
    };
  }

  return history;
};