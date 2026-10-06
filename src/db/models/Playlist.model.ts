import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPlaylistItem {
  label: string;
  videoId: string;
  addedAt: Date;
}

export interface IPlaylist extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  items: IPlaylistItem[];
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const playlistItemSchema = new Schema<IPlaylistItem>(
  {
    label: { type: String, required: true, maxlength: 80 },
    videoId: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const playlistSchema = new Schema<IPlaylist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 60 },
    items: { type: [playlistItemSchema], default: [] },
    isDraft: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Playlist: Model<IPlaylist> = mongoose.model<IPlaylist>(
  'Playlist',
  playlistSchema
);