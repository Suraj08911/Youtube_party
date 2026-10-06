import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { Room as RoomModel, Role } from '../../db/models/Room.model';
import { roomManager } from '../classes/RoomManager';
import { SOCKET_EVENTS } from '../socket.events';
import { logger } from '../../utils/logger';

const VALID_ROLES: Role[] = ['moderator', 'participant', 'viewer'];

export const registerRoleHandlers = (io: Server, socket: Socket): void => {
  socket.on(SOCKET_EVENTS.REQUEST_MODERATOR, () => {
    if (!socket.user) return;
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    const requester = room.getParticipant(socket.user.userId);
    if (!requester || requester.role !== 'participant') {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only participants can request moderator access' });
    }
    if (room.moderatorRequests.has(requester.userId)) {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Your moderator request is already pending' });
    }

    const host = room.getParticipant(room.hostId);
    if (!host || host.role !== 'host') {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: 'The host is currently unavailable' });
    }

    room.moderatorRequests.add(requester.userId);
    io.to(host.socketId).emit(SOCKET_EVENTS.MODERATOR_REQUEST, {
      userId: requester.userId,
      username: requester.username,
    });
    socket.emit(SOCKET_EVENTS.MODERATOR_REQUEST_RESULT, { status: 'pending' });
  });

  socket.on(
    SOCKET_EVENTS.RESOLVE_MODERATOR_REQUEST,
    async (payload: { userId: string; approved: boolean }) => {
      try {
        if (!socket.user) return;
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room || !room.isHost(socket.user.userId)) return;

        const { userId, approved } = payload || {};
        if (!userId || typeof approved !== 'boolean' || !room.moderatorRequests.has(userId)) return;

        room.moderatorRequests.delete(userId);
        const requester = room.getParticipant(userId);
        if (!requester) return;

        if (approved && requester.role === 'participant') {
          requester.role = 'moderator';
          await RoomModel.updateOne(
            { _id: room.roomId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
            { $set: { 'participants.$.role': 'moderator' } }
          );
          io.to(room.roomId).emit(SOCKET_EVENTS.ROLE_ASSIGNED, {
            userId,
            username: requester.username,
            role: 'moderator',
            participants: room.serializeParticipants(),
          });
        }

        io.to(requester.socketId).emit(SOCKET_EVENTS.MODERATOR_REQUEST_RESULT, {
          status: approved && requester.role === 'moderator' ? 'approved' : 'denied',
        });
      } catch (err: any) {
        logger.error(`resolve_moderator_request error: ${err.message}`);
      }
    }
  );

  socket.on(SOCKET_EVENTS.ASSIGN_ROLE, async (payload: { userId: string; role: Role }) => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      if (!room.canManageRoom(socket.user.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only Host can assign roles' });
      }

      const { userId, role } = payload || {};
      if (!userId || !VALID_ROLES.includes(role)) return;

      const target = room.getParticipant(userId);
      if (!target) return;

      target.role = role;
      const hadModeratorRequest = room.moderatorRequests.delete(userId);

      await RoomModel.updateOne(
        { _id: room.roomId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
        { $set: { 'participants.$.role': role } }
      );

      io.to(room.roomId).emit(SOCKET_EVENTS.ROLE_ASSIGNED, {
        userId,
        username: target.username,
        role,
        participants: room.serializeParticipants(),
      });
      if (hadModeratorRequest) {
        io.to(target.socketId).emit(SOCKET_EVENTS.MODERATOR_REQUEST_RESULT, {
          status: role === 'moderator' ? 'approved' : 'denied',
        });
      }

      logger.info(`👑 ${target.username} → ${role} in ${room.code}`);
    } catch (err: any) {
      logger.error(`assign_role error: ${err.message}`);
    }
  });

  socket.on(SOCKET_EVENTS.REMOVE_PARTICIPANT, async (payload: { userId: string }) => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      if (!room.canManageRoom(socket.user.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only Host can remove' });
      }

      const { userId } = payload || {};
      if (!userId || userId === socket.user.userId) return;

      const target = room.getParticipant(userId);
      if (!target) return;

      io.to(target.socketId).emit(SOCKET_EVENTS.PARTICIPANT_REMOVED, { userId });

      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.leave(room.roomId);
        if (targetSocket.user) targetSocket.user.roomId = undefined;
      }

      room.removeParticipantByUserId(userId);

      await RoomModel.updateOne(
        { _id: room.roomId },
        { $pull: { participants: { userId: new mongoose.Types.ObjectId(userId) } } }
      );

      io.to(room.roomId).emit(SOCKET_EVENTS.USER_LEFT, {
        userId,
        username: target.username,
        participants: room.serializeParticipants(),
      });
    } catch (err: any) {
      logger.error(`remove_participant error: ${err.message}`);
    }
  });

  socket.on(SOCKET_EVENTS.TRANSFER_HOST, async (payload: { userId: string }) => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      if (!room.isHost(socket.user.userId)) return;

      const { userId } = payload || {};
      if (!userId) return;

      const oldHost = room.getParticipant(socket.user.userId);
      const newHost = room.getParticipant(userId);
      if (!newHost) return;

      if (oldHost) oldHost.role = 'moderator';
      newHost.role = 'host';
      room.hostId = newHost.userId;

      await RoomModel.updateOne(
        { _id: room.roomId },
        { hostId: new mongoose.Types.ObjectId(newHost.userId) }
      );
      await RoomModel.updateOne(
        { _id: room.roomId, 'participants.userId': new mongoose.Types.ObjectId(newHost.userId) },
        { $set: { 'participants.$.role': 'host' } }
      );
      if (oldHost) {
        await RoomModel.updateOne(
          { _id: room.roomId, 'participants.userId': new mongoose.Types.ObjectId(oldHost.userId) },
          { $set: { 'participants.$.role': 'moderator' } }
        );
      }

      io.to(room.roomId).emit(SOCKET_EVENTS.HOST_TRANSFERRED, {
        newHostId: newHost.userId,
        newHostUsername: newHost.username,
        oldHostId: oldHost?.userId,
        participants: room.serializeParticipants(),
      });
    } catch (err: any) {
      logger.error(`transfer_host error: ${err.message}`);
    }
  });
};
