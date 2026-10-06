import mongoose, { Schema, Document, Model } from 'mongoose';

export type Role = 'host' | 'moderator' | 'participant' | 'viewer';

export interface IRoomParticipant {
  userId: mongoose.Types.ObjectId;
  username: string;
  role: Role;
  joinedAt: Date;
}

export interface IPlaylistItem {
  label: string;
  videoId: string;
  addedAt: Date;
}

export interface IAudioState {
  masterVolume: number;
  bass: number;
  mid: number;
  treble: number;
  eq60: number;
  eq150: number;
  eq400: number;
  eq1k: number;
  eq2_4k: number;
  eq6k: number;
  eq12k: number;
  balance: number;
  stereoWidth: number;
  reverb: number;
  bassBoost: number;
  vocalBoost: number;
  compressor: number;
  limiter: number;
}

export interface IRoom extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  hostId: mongoose.Types.ObjectId;
  videoId: string | null;
  playState: 'playing' | 'paused';
  currentTime: number;
  lastSyncAt: number;
  partyMode: boolean;
  superPartyMode: boolean;
  hostOnline: boolean;
  lastActivityAt: Date;
  audioState: IAudioState;
  playlist: IPlaylistItem[];
  participants: IRoomParticipant[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_AUDIO_STATE: IAudioState = {
  masterVolume: 80,
  bass: 0,
  mid: 0,
  treble: 0,
  eq60: 0,
  eq150: 0,
  eq400: 0,
  eq1k: 0,
  eq2_4k: 0,
  eq6k: 0,
  eq12k: 0,
  balance: 0,
  stereoWidth: 100,
  reverb: 0,
  bassBoost: 0,
  vocalBoost: 0,
  compressor: 0,
  limiter: 100,
};

const participantSchema = new Schema<IRoomParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    role: {
      type: String,
      enum: ['host', 'moderator', 'participant', 'viewer'],
      default: 'participant',
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const playlistItemSchema = new Schema<IPlaylistItem>(
  {
    label: { type: String, required: true, maxlength: 80 },
    videoId: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const roomSchema = new Schema<IRoom>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    videoId: { type: String, default: null },
    playState: { type: String, enum: ['playing', 'paused'], default: 'paused' },
    currentTime: { type: Number, default: 0, min: 0 },
    lastSyncAt: { type: Number, default: Date.now },
    partyMode: { type: Boolean, default: false },
    superPartyMode: { type: Boolean, default: false },
    hostOnline: { type: Boolean, default: true },
    lastActivityAt: { type: Date, default: Date.now },
    audioState: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_AUDIO_STATE }),
    },
    playlist: { type: [playlistItemSchema], default: [] },
    participants: { type: [participantSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ code: 1 }, { unique: true });
roomSchema.index({ hostId: 1 });
roomSchema.index({ isActive: 1 });

export const Room: Model<IRoom> = mongoose.model<IRoom>('Room', roomSchema);