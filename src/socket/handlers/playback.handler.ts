import { Server, Socket } from 'socket.io';
import { Room as RoomModel } from '../../db/models/Room.model';
import { roomManager } from '../classes/RoomManager';
import { SOCKET_EVENTS } from '../socket.events';
import { logger } from '../../utils/logger';

const withPlaybackPermission = (
  socket: Socket,
  eventName: string,
  handler: (ctx: { room: any; payload: any }) => Promise<unknown> | unknown
) => {
  return async (payload: any) => {
    try {
      if (!socket.user)
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Not authenticated',
        });
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room)
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not in a room' });

      if (!room.canControlPlayback(socket.user.userId)) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: `Only Host/Moderator can ${eventName}`,
        });
      }
      await handler({ room, payload });
    } catch (err: any) {
      logger.error(`${eventName} error: ${err.message}`);
    }
  };
};

const buildSyncPayload = (room: any, override: any = {}) => ({
  videoId: room.videoId,
  playState: room.playState,
  currentTime: room.currentTime,
  lastSyncAt: room.lastSyncAt,
  serverTime: Date.now(),
  ...override,
});

export const registerPlaybackHandlers = (io: Server, socket: Socket): void => {
  socket.on(
    SOCKET_EVENTS.PLAY,
    withPlaybackPermission(socket, 'play', async ({ room, payload }) => {
      room.playState = 'playing';
      if (typeof payload?.currentTime === 'number')
        room.currentTime = payload.currentTime;
      room.lastSyncAt = Date.now();

      // ⭐ Immediate broadcast
      io.to(room.roomId).emit(
        SOCKET_EVENTS.SYNC_STATE,
        buildSyncPayload(room)
      );

      // ⭐ DB async
      RoomModel.updateOne(
        { _id: room.roomId },
        {
          playState: 'playing',
          currentTime: room.currentTime,
          lastSyncAt: room.lastSyncAt,
          lastActivityAt: new Date(),
        }
      ).catch((err) => logger.error(`DB error: ${err.message}`));
    })
  );

  socket.on(
    SOCKET_EVENTS.PAUSE,
    withPlaybackPermission(socket, 'pause', async ({ room, payload }) => {
      room.playState = 'paused';
      if (typeof payload?.currentTime === 'number')
        room.currentTime = payload.currentTime;
      room.lastSyncAt = Date.now();

      io.to(room.roomId).emit(
        SOCKET_EVENTS.SYNC_STATE,
        buildSyncPayload(room)
      );

      RoomModel.updateOne(
        { _id: room.roomId },
        {
          playState: 'paused',
          currentTime: room.currentTime,
          lastSyncAt: room.lastSyncAt,
          lastActivityAt: new Date(),
        }
      ).catch((err) => logger.error(`DB error: ${err.message}`));
    })
  );

  socket.on(
    SOCKET_EVENTS.SEEK,
    withPlaybackPermission(socket, 'seek', async ({ room, payload }) => {
      const time = Number(payload?.time);
      if (!Number.isFinite(time) || time < 0) return;
      room.currentTime = time;
      room.lastSyncAt = Date.now();

      io.to(room.roomId).emit(
        SOCKET_EVENTS.SYNC_STATE,
        buildSyncPayload(room)
      );

      RoomModel.updateOne(
        { _id: room.roomId },
        { currentTime: time, lastSyncAt: room.lastSyncAt }
      ).catch((err) => logger.error(`DB error: ${err.message}`));
    })
  );

  socket.on(
    SOCKET_EVENTS.CHANGE_VIDEO,
    withPlaybackPermission(socket, 'change_video', async ({ room, payload }) => {
      const videoId = payload?.videoId;
      if (!videoId || typeof videoId !== 'string') return;

      room.videoId = videoId;
      room.currentTime = 0;
      room.playState = 'playing';
      room.lastSyncAt = Date.now();

      io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, {
        videoId,
        playState: 'playing',
        currentTime: 0,
        lastSyncAt: room.lastSyncAt,
        serverTime: Date.now(),
      });

      const inPlaylist = room.playlist.some(
        (v: { videoId: string }) => v.videoId === videoId
      );
      if (!inPlaylist) {
        const item = { label: videoId, videoId, addedAt: new Date() };
        room.playlist.push(item);
        RoomModel.updateOne(
          { _id: room.roomId },
          {
            videoId,
            currentTime: 0,
            playState: 'playing',
            lastSyncAt: room.lastSyncAt,
            $push: { playlist: item },
          }
        ).catch((err) => logger.error(`DB error: ${err.message}`));
      } else {
        RoomModel.updateOne(
          { _id: room.roomId },
          {
            videoId,
            currentTime: 0,
            playState: 'playing',
            lastSyncAt: room.lastSyncAt,
          }
        ).catch((err) => logger.error(`DB error: ${err.message}`));
      }
    })
  );

  socket.on(
    SOCKET_EVENTS.PLAY_FROM_PLAYLIST,
    withPlaybackPermission(
      socket,
      'play_from_playlist',
      async ({ room, payload }) => {
        const videoId = payload?.videoId;
        if (!videoId) return;

        const inPlaylist = room.playlist.some(
          (v: { videoId: string }) => v.videoId === videoId
        );
        if (!inPlaylist)
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Video not in playlist',
          });

        room.videoId = videoId;
        room.currentTime = 0;
        room.playState = 'playing';
        room.lastSyncAt = Date.now();

        io.to(room.roomId).emit(SOCKET_EVENTS.SYNC_STATE, {
          videoId,
          playState: 'playing',
          currentTime: 0,
          lastSyncAt: room.lastSyncAt,
          serverTime: Date.now(),
        });

        RoomModel.updateOne(
          { _id: room.roomId },
          {
            videoId,
            currentTime: 0,
            playState: 'playing',
            lastSyncAt: room.lastSyncAt,
          }
        ).catch((err) => logger.error(`DB error: ${err.message}`));
      }
    )
  );

  socket.on(
    SOCKET_EVENTS.ADD_TO_PLAYLIST,
    withPlaybackPermission(
      socket,
      'add_to_playlist',
      async ({ room, payload }) => {
        const { label, videoId } = payload || {};
        if (!videoId || typeof videoId !== 'string')
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Video ID required',
          });

        const exists = room.playlist.some(
          (v: { videoId: string }) => v.videoId === videoId
        );
        if (exists)
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: '⚠️ Already in playlist',
          });

        const item = {
          label: label?.trim() || videoId,
          videoId,
          addedAt: new Date(),
        };
        room.playlist.push(item);

        io.to(room.roomId).emit(SOCKET_EVENTS.PLAYLIST_UPDATED, {
          playlist: room.playlist,
        });

        RoomModel.updateOne(
          { _id: room.roomId },
          { $push: { playlist: item } }
        ).catch((err) => logger.error(`DB error: ${err.message}`));
      }
    )
  );

  socket.on(SOCKET_EVENTS.REQUEST_SYNC, () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    let adjustedTime = room.currentTime;
    if (room.playState === 'playing' && room.lastSyncAt) {
      const elapsed = (Date.now() - room.lastSyncAt) / 1000;
      adjustedTime = room.currentTime + elapsed;
    }

    socket.emit(SOCKET_EVENTS.SYNC_STATE, {
      videoId: room.videoId,
      playState: room.playState,
      currentTime: adjustedTime,
      lastSyncAt: Date.now(),
      serverTime: Date.now(),
    });
  });
};
