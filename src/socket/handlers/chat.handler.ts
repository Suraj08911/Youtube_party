import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { ChatMessage } from '../../db/models/ChatMessage.model';
import type { ChatMessage as RoomChatMessage, Room } from '../classes/Room';
import { roomManager } from '../classes/RoomManager';
import { SOCKET_EVENTS } from '../socket.events';
import { logger } from '../../utils/logger';

export const registerChatHandlers = (io: Server, socket: Socket): void => {
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async (payload: { message: string }) => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      if (!room.canChat(socket.user.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Viewers cannot send messages',
        });
      }

      const message = String(payload?.message || '').trim().slice(0, 500);
      if (!message) return;

      const chatPayload = {
        userId: socket.user.userId,
        username: socket.user.username,
        message,
        timestamp: Date.now(),
      };

      room.addChatMessage(chatPayload);

      io.to(room.roomId).emit(SOCKET_EVENTS.CHAT_RECEIVED, chatPayload);
      logger.info(`💬 ${socket.user.username}: ${message} [${room.code}]`);
    } catch (err: any) {
      logger.error(`chat_message error: ${err.message}`);
    }
  });

  // ⭐ Reactions — broadcast to ALL
  socket.on(SOCKET_EVENTS.REACTION, (payload: { emoji: string }) => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const emoji = String(payload?.emoji || '').slice(0, 4);
      if (!emoji) return;

      const reactionPayload = {
        userId: socket.user.userId,
        username: socket.user.username,
        emoji,
        timestamp: Date.now(),
      };

      // ⭐ Broadcast to EVERYONE including sender
      io.to(room.roomId).emit(
        SOCKET_EVENTS.REACTION_RECEIVED,
        reactionPayload
      );

      logger.info(`✨ ${socket.user.username} reacted ${emoji} [${room.code}]`);
    } catch (err: any) {
      logger.error(`reaction error: ${err.message}`);
    }
  });
};

export const loadChatHistory = async (room: Room): Promise<RoomChatMessage[]> => {
  const rows = await ChatMessage.find({
    roomId: new mongoose.Types.ObjectId(room.roomId),
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return rows
    .map((row) => ({
      userId: row.userId.toString(),
      username: row.username,
      message: row.message,
      timestamp: row.createdAt.getTime(),
    }))
    .reverse();
};

export const flushRoomChatsToDb = async (room: Room): Promise<void> => {
  const pending = room.getUnsavedChats();
  if (pending.length === 0) return;

  await ChatMessage.insertMany(
    pending.map((message) => ({
      roomId: new mongoose.Types.ObjectId(room.roomId),
      userId: new mongoose.Types.ObjectId(message.userId),
      username: message.username,
      message: message.message,
      createdAt: new Date(message.timestamp),
      updatedAt: new Date(message.timestamp),
    }))
  );
  room.clearUnsavedChats();
};
