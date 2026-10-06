import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChatMessage extends Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username: string;
  message: string;
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    message: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

chatMessageSchema.index({ roomId: 1, createdAt: -1 });

export const ChatMessage: Model<IChatMessage> = mongoose.model<IChatMessage>(
  'ChatMessage',
  chatMessageSchema
);