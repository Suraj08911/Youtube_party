import { roomManager } from '../classes/RoomManager';
import { flushRoomChatsToDb } from './chat.handler';
import { logger } from '../../utils/logger';

/**
 * Background flusher — har 5 minute mein sab rooms ke chats DB mein save karo
 */
export const startChatFlusher = (): void => {
  setInterval(async () => {
    const rooms = roomManager.getAllRooms();
    if (rooms.length === 0) return;

    let totalFlushed = 0;

    for (const room of rooms) {
      if (room.shouldFlushToDb()) {
        try {
          await flushRoomChatsToDb(room);
          totalFlushed++;
        } catch (err: any) {
          logger.error(`Flush failed for ${room.code}: ${err.message}`);
        }
      }
    }

    if (totalFlushed > 0) {
      logger.info(`💾 Flushed chats from ${totalFlushed} rooms`);
    }
  }, 5 * 60 * 1000); // ⭐ Every 5 minutes

  logger.info('✅ Chat flusher started (5 min interval)');
};