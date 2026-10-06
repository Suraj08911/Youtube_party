import { Room } from './Room';
import { logger } from '../../utils/logger';

class RoomManager {
  private rooms: Map<string, Room> = new Map(); // roomId → Room
  private codeToRoomId: Map<string, string> = new Map(); // code → roomId

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByCode(code: string): Room | undefined {
    const roomId = this.codeToRoomId.get(code.toUpperCase());
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getRoomBySocket(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.socketToUser.has(socketId)) return room;
    }
    return undefined;
  }

  addRoom(room: Room): void {
    this.rooms.set(room.roomId, room);
    this.codeToRoomId.set(room.code.toUpperCase(), room.roomId);
    logger.debug(`Room added to manager: ${room.code}`);
  }

  removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.codeToRoomId.delete(room.code.toUpperCase());
      this.rooms.delete(roomId);
      logger.debug(`Room removed from manager: ${room.code}`);
    }
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  stats() {
    return {
      totalRooms: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values()).reduce(
        (sum, r) => sum + r.participants.size,
        0
      ),
    };
  }

  // Cleanup empty rooms periodically
  cleanup(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.isEmpty()) {
        this.removeRoom(roomId);
      }
    }
  }
}

export const roomManager = new RoomManager();

// Cleanup every 5 minutes
setInterval(() => roomManager.cleanup(), 5 * 60 * 1000);