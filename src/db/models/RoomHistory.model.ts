import mongoose, { Schema, Document, Model } from 'mongoose';
import { Role } from './Room.model';

export interface IRoomHistoryEntry {
  roomId: mongoose.Types.ObjectId;
  roomCode: string;
  roomName: string;
  joinedAt: Date;
  leftAt: Date | null;
  duration: number;
  role: Role;
  totalMembers: number;
  hostUsername: string;
}

export interface IRoomHistory extends Document {
  userId: mongoose.Types.ObjectId;
  username: string;
  entries: IRoomHistoryEntry[];
  stats: {
    hostCount: number;
    moderatorCount: number;
    participantCount: number;
    viewerCount: number;
    totalRooms: number;
    totalWatchTime: number;
  };
}

const entrySchema = new Schema<IRoomHistoryEntry>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    roomCode: { type: String, required: true },
    roomName: { type: String, required: true },
    joinedAt: { type: Date, required: true },
    leftAt: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ['host', 'moderator', 'participant', 'viewer'],
      required: true,
    },
    totalMembers: { type: Number, default: 1 },
    hostUsername: { type: String, default: '' },
  },
  { _id: false }
);

const roomHistorySchema = new Schema<IRoomHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    username: { type: String, required: true },
    entries: { type: [entrySchema], default: [] },
    stats: {
      hostCount: { type: Number, default: 0 },
      moderatorCount: { type: Number, default: 0 },
      participantCount: { type: Number, default: 0 },
      viewerCount: { type: Number, default: 0 },
      totalRooms: { type: Number, default: 0 },
      totalWatchTime: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const RoomHistory: Model<IRoomHistory> = mongoose.model<IRoomHistory>(
  'RoomHistory',
  roomHistorySchema
);