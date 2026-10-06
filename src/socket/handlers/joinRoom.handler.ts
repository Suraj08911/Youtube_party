import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { Room as RoomModel } from '../../db/models/Room.model';
import { Room } from '../classes/Room';
import { roomManager } from '../classes/RoomManager';
import { SOCKET_EVENTS } from '../socket.events';
import { logger } from '../../utils/logger';
import * as historyService from '../../modules/history/history.service';
import { loadChatHistory, flushRoomChatsToDb } from './chat.handler';

interface JoinPayload {
  roomCode: string;
}

const ROOM_GRACE_PERIOD_MS = 5 * 60 * 1000;
const pendingRoomClosures = new Map<string, NodeJS.Timeout>();

const scheduleRoomClosure = async (room: Room, io: Server) => {
  const roomId = room.roomId;
  const code = room.code;

  const existing = pendingRoomClosures.get(roomId);
  if (existing) clearTimeout(existing);

  logger.info(`⏳ Room ${code} empty — scheduled delete in 5 min`);

  const timer = setTimeout(async () => {
    try {
      const still = roomManager.getRoom(roomId);
      if (still && !still.isEmpty()) {
        logger.info(`✅ Room ${code} revived`);
        pendingRoomClosures.delete(roomId);
        return;
      }

      if (still) {
        try {
          await flushRoomChatsToDb(still);
        } catch (err: any) {
          logger.error(`Flush failed: ${err.message}`);
        }
      }

      await RoomModel.deleteOne({ _id: roomId });
      roomManager.removeRoom(roomId);
      pendingRoomClosures.delete(roomId);

      io.emit('room_deleted', { roomId, code });

      logger.info(`🗑️ Room ${code} deleted`);
    } catch (err: any) {
      logger.error(`Delete failed: ${err.message}`);
      pendingRoomClosures.delete(roomId);
    }
  }, ROOM_GRACE_PERIOD_MS);

  pendingRoomClosures.set(roomId, timer);
};

const cancelRoomClosure = (roomId: string) => {
  const timer = pendingRoomClosures.get(roomId);
  if (timer) {
    clearTimeout(timer);
    pendingRoomClosures.delete(roomId);
  }
};

export const registerJoinRoomHandlers = (io: Server, socket: Socket): void => {
  // ═══════════════════════════════════════════════════════════
  // JOIN ROOM — ⭐ ONLY joins ONE room (user can't be in multiple)
  // ═══════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinPayload) => {
    try {
      if (!socket.user) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Not authenticated',
        });
      }

      const { roomCode } = payload || {};
      if (!roomCode || typeof roomCode !== 'string') {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Room code required',
        });
      }

      // ⭐ LEAVE any previous room FIRST
      const existingRoom = roomManager.getRoomBySocket(socket.id);
      if (existingRoom) {
        socket.leave(existingRoom.roomId);
        existingRoom.removeParticipantBySocket(socket.id);
        if (existingRoom.isEmpty()) {
          await scheduleRoomClosure(existingRoom, io);
        }
        logger.info(
          `↩️ Socket left ${existingRoom.code} to join ${roomCode}`
        );
      }

      const dbRoom = await RoomModel.findOne({
        code: roomCode.toUpperCase(),
      });

      if (!dbRoom) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Room not found or has been deleted',
        });
      }

      const roomId = dbRoom._id.toString();
      cancelRoomClosure(roomId);

      let room = roomManager.getRoom(roomId);
      if (!room) {
        room = new Room(roomId, dbRoom.code, dbRoom.hostId.toString(), {
          videoId: dbRoom.videoId,
          playState: dbRoom.playState,
          currentTime: dbRoom.currentTime,
          lastSyncAt: (dbRoom as any).lastSyncAt ?? Date.now(),
          partyMode: dbRoom.partyMode,
          superPartyMode: (dbRoom as any).superPartyMode ?? false,
          hostOnline: dbRoom.hostOnline,
          audioState: dbRoom.audioState,
          playlist: dbRoom.playlist || [],
        });
        roomManager.addRoom(room);

        try {
          const preloaded = await loadChatHistory(room);
          if (preloaded.length > 0) {
            room.mergeChats(preloaded);
            room.unsavedChats = [];
          }
        } catch (err: any) {
          logger.error(`Preload failed: ${err.message}`);
        }
      }

      const dbParticipant = dbRoom.participants.find(
        (p) => p.userId.toString() === socket.user!.userId
      );

      if (!dbParticipant) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Join via API first',
        });
      }

      room.removeParticipantByUserId(socket.user.userId);
      room.addParticipant({
        userId: socket.user.userId,
        username: socket.user.username,
        role: dbParticipant.role,
        socketId: socket.id,
        joinedAt: new Date(),
      });

      // ⭐ User joins socket room — isolated from other rooms
      socket.join(roomId);
      socket.user.roomId = roomId;
      socket.user.role = dbParticipant.role;

      if (dbParticipant.role === 'host') {
        room.markHostOnline();
        await RoomModel.updateOne(
          { _id: room.roomId },
          { hostOnline: true, lastActivityAt: new Date() }
        );
        io.to(room.roomId).emit(SOCKET_EVENTS.HOST_ONLINE, {
          message: 'Host is back!',
        });
      }

      try {
        const hostParticipant = dbRoom.participants.find(
          (p) => p.role === 'host'
        );

        await historyService.recordJoin({
          userId: socket.user.userId,
          username: socket.user.username,
          roomId: room.roomId,
          roomCode: room.code,
          roomName: dbRoom.name,
          role: dbParticipant.role,
          totalMembers: room.participants.size,
          hostUsername: hostParticipant?.username || 'Unknown',
        });
      } catch (err: any) {
        logger.error(`history failed: ${err.message}`);
      }

      try {
        const history = await loadChatHistory(room);
        socket.emit(SOCKET_EVENTS.CHAT_HISTORY, history);
      } catch {
        socket.emit(SOCKET_EVENTS.CHAT_HISTORY, []);
      }

      socket.emit(SOCKET_EVENTS.SYNC_STATE, room.serializeState());

      socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, {
        userId: socket.user.userId,
        username: socket.user.username,
        role: dbParticipant.role,
        participants: room.serializeParticipants(),
      });

      logger.info(
        `👤 ${socket.user.username} joined ${room.code} as ${dbParticipant.role}`
      );
    } catch (err: any) {
      logger.error(`join_room error: ${err.message}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join room' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // LEAVE ROOM
  // ═══════════════════════════════════════════════════════════
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, async () => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const removed = room.removeParticipantBySocket(socket.id);
      socket.leave(room.roomId);

      if (removed) {
        await historyService.recordLeave(removed.userId, room.roomId);
        io.to(room.roomId).emit(SOCKET_EVENTS.USER_LEFT, {
          userId: removed.userId,
          username: removed.username,
          participants: room.serializeParticipants(),
        });

        if (room.isEmpty()) {
          await scheduleRoomClosure(room, io);
        }
      }

      socket.user.roomId = undefined;
    } catch (err: any) {
      logger.error(`leave_room error: ${err.message}`);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // CLOSE ROOM
  // ═══════════════════════════════════════════════════════════
  socket.on('close_room', async () => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      if (!room.isHost(socket.user.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Only Host can close the room',
        });
      }

      io.to(room.roomId).emit('room_closed', {
        message: 'Host closed the room permanently',
      });

      await RoomModel.deleteOne({ _id: room.roomId });
      cancelRoomClosure(room.roomId);

      const sockets = await io.in(room.roomId).fetchSockets();
      sockets.forEach((s) => {
        s.leave(room.roomId);
      });

      roomManager.removeRoom(room.roomId);
      io.emit('room_deleted', { roomId: room.roomId, code: room.code });
    } catch (err: any) {
      logger.error(`close_room error: ${err.message}`);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // DISCONNECT
  // ═══════════════════════════════════════════════════════════
  socket.on('disconnect', async () => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const removed = room.removeParticipantBySocket(socket.id);
      if (!removed) return;

      await historyService.recordLeave(removed.userId, room.roomId);

      if (removed.role === 'host') {
        room.markHostOffline();
        await RoomModel.updateOne(
          { _id: room.roomId },
          { hostOnline: false, lastActivityAt: new Date() }
        );
        io.to(room.roomId).emit(SOCKET_EVENTS.HOST_OFFLINE, {
          message: 'Host disconnected. Playback continues.',
        });
      } else {
        io.to(room.roomId).emit(SOCKET_EVENTS.USER_LEFT, {
          userId: removed.userId,
          username: removed.username,
          participants: room.serializeParticipants(),
        });
      }

      if (room.isEmpty()) {
        await scheduleRoomClosure(room, io);
      }
    } catch (err: any) {
      logger.error(`disconnect error: ${err.message}`);
    }
  });
};
