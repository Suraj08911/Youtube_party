import { Server, Socket } from 'socket.io';
import { Room as RoomModel } from '../../db/models/Room.model';
import { roomManager } from '../classes/RoomManager';
import { SOCKET_EVENTS } from '../socket.events';
import { logger } from '../../utils/logger';

const SUPER_ONLY = new Set([
  'reverb',
  'stereoWidth',
  'compressor',
  'limiter',
  'bassBoost',
  'vocalBoost',
  'balance',
]);

export const registerAudioHandlers = (io: Server, socket: Socket): void => {
  socket.on(
    SOCKET_EVENTS.AUDIO_PARAM_UPDATE,
    async (payload: { param: string; value: number }) => {
      try {
        if (!socket.user) return;
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) {
          logger.warn('Audio: not in room');
          return;
        }

        const { param, value } = payload || {};
        if (typeof param !== 'string' || typeof value !== 'number') {
          logger.warn(`Audio: invalid payload ${JSON.stringify(payload)}`);
          return;
        }

        const role = room.getRole(socket.user.userId);
        if (!role) return;

        if (!room.canControlPlayback(socket.user.userId)) {
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Only Host/Moderator can update audio',
          });
        }

        if (SUPER_ONLY.has(param)) {
          if (role !== 'host') {
            return socket.emit(SOCKET_EVENTS.ERROR, {
              message: 'Only Host can modify this',
            });
          }
          if (!room.superPartyMode) {
            return socket.emit(SOCKET_EVENTS.ERROR, {
              message: 'Enable Super Party Mode first',
            });
          }
        }

        // ⭐ Update in-memory
        (room.audioState as any)[param] = value;

        // ⭐ Broadcast to ALL clients (including sender)
        io.to(room.roomId).emit(SOCKET_EVENTS.AUDIO_STATE, {
          ...room.audioState,
          updatedParam: param,
        });

        logger.info(
          `🎚️ Audio: ${param}=${value} by ${socket.user.username} [${room.code}]`
        );

        // ⭐ Async DB save
        RoomModel.updateOne(
          { _id: room.roomId },
          { [`audioState.${param}`]: value }
        ).catch((err) => logger.error(`Audio DB: ${err.message}`));
      } catch (err: any) {
        logger.error(`audio_param_update error: ${err.message}`);
      }
    }
  );

  socket.on(
    SOCKET_EVENTS.PARTY_MODE_TOGGLE,
    async (payload: { enabled: boolean }) => {
      try {
        if (!socket.user) return;
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        if (!room.canManageRoom(socket.user.userId)) return;

        const enabled = Boolean(payload?.enabled);
        room.partyMode = enabled;

        io.to(room.roomId).emit(SOCKET_EVENTS.PARTY_MODE_CHANGED, { enabled });

        RoomModel.updateOne(
          { _id: room.roomId },
          { partyMode: enabled }
        ).catch((err) => logger.error(`DB: ${err.message}`));
      } catch (err: any) {
        logger.error(`party_mode error: ${err.message}`);
      }
    }
  );

  socket.on(
    SOCKET_EVENTS.SUPER_PARTY_MODE_TOGGLE,
    async (payload: { enabled: boolean }) => {
      try {
        if (!socket.user) return;
        const room = roomManager.getRoomBySocket(socket.id);
        if (!room) return;
        if (!room.canManageRoom(socket.user.userId)) {
          return socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Only Host can toggle Super Party Mode',
          });
        }

        const enabled = Boolean(payload?.enabled);
        room.superPartyMode = enabled;

        io.to(room.roomId).emit(SOCKET_EVENTS.SUPER_PARTY_MODE_CHANGED, {
          enabled,
          audioState: room.audioState,
        });

        RoomModel.updateOne(
          { _id: room.roomId },
          { superPartyMode: enabled }
        ).catch((err) => logger.error(`DB: ${err.message}`));

        logger.info(`⭐ Super ${enabled ? 'ON' : 'OFF'} [${room.code}]`);
      } catch (err: any) {
        logger.error(`super_party_mode error: ${err.message}`);
      }
    }
  );

  socket.on(SOCKET_EVENTS.PRESET_APPLY, async (payload: { preset: string }) => {
    try {
      if (!socket.user) return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;
      if (!room.canControlPlayback(socket.user.userId)) return;

      const preset = payload?.preset;
      if (typeof preset !== 'string') return;

      const PRESETS: Record<string, Partial<typeof room.audioState>> = {
        NORMAL: {
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
        },
        PARTY: {
          masterVolume: 85,
          bass: 7,
          mid: 2,
          treble: 5,
          reverb: 15,
          stereoWidth: 130,
          compressor: 50,
          limiter: 100,
        },
        BASS_BOOST: { bass: 10, eq60: 8, eq150: 6, bassBoost: 70 },
        VOCAL: { mid: 4, eq1k: 3, eq2_4k: 5, vocalBoost: 60 },
        CLUB: { bass: 6, treble: 4, reverb: 25, stereoWidth: 150 },
        CHILL: { bass: -2, treble: 2, reverb: 30, stereoWidth: 110 },
        ROCK: { bass: 4, mid: 3, treble: 6, compressor: 60 },
        CLASSICAL: { mid: 2, treble: 3, reverb: 20, stereoWidth: 120 },
      };

      const config = PRESETS[preset];
      if (!config) return;

      const usesSuper = Object.keys(config).some((k) => SUPER_ONLY.has(k));
      if (usesSuper && !room.superPartyMode) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Enable Super Party Mode to use this preset',
        });
      }

      Object.assign(room.audioState, config);

      io.to(room.roomId).emit(SOCKET_EVENTS.AUDIO_STATE, {
        ...room.audioState,
        presetApplied: preset,
      });

      RoomModel.updateOne(
        { _id: room.roomId },
        { audioState: room.audioState }
      ).catch((err) => logger.error(`DB: ${err.message}`));

      logger.info(`🎵 Preset "${preset}" applied [${room.code}]`);
    } catch (err: any) {
      logger.error(`preset_apply error: ${err.message}`);
    }
  });
};