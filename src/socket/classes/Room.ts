import { Server } from 'socket.io';
import {
  Role,
  IAudioState,
  DEFAULT_AUDIO_STATE,
  IPlaylistItem,
} from '../../db/models/Room.model';

export interface ParticipantData {
  userId: string;
  username: string;
  role: Role;
  socketId: string;
  joinedAt: Date;
}

export interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

const MAX_CHAT_BUFFER = 200;

export class Room {
  public participants: Map<string, ParticipantData> = new Map();
  public socketToUser: Map<string, string> = new Map();
  public moderatorRequests: Set<string> = new Set();

  public videoId: string | null;
  public playState: 'playing' | 'paused';
  public currentTime: number;
  public lastSyncAt: number;
  public partyMode: boolean;
  public superPartyMode: boolean;
  public hostOnline: boolean;
  public audioState: IAudioState;
  public playlist: IPlaylistItem[];

  // ⭐ CHAT BUFFER (in-memory)
  public chatBuffer: ChatMessage[] = [];
  public unsavedChats: ChatMessage[] = []; // Chats since last DB flush
  private lastDbFlush: number = Date.now();

  constructor(
    public roomId: string,
    public code: string,
    public hostId: string,
    data?: Partial<{
      videoId: string | null;
      playState: 'playing' | 'paused';
      currentTime: number;
      lastSyncAt: number;
      partyMode: boolean;
      superPartyMode: boolean;
      hostOnline: boolean;
      audioState: IAudioState;
      playlist: IPlaylistItem[];
    }>
  ) {
    this.videoId = data?.videoId ?? null;
    this.playState = data?.playState ?? 'paused';
    this.currentTime = data?.currentTime ?? 0;
    this.lastSyncAt = data?.lastSyncAt ?? Date.now();
    this.partyMode = data?.partyMode ?? false;
    this.superPartyMode = data?.superPartyMode ?? false;
    this.hostOnline = data?.hostOnline ?? true;
    this.audioState = data?.audioState ?? { ...DEFAULT_AUDIO_STATE };
    this.playlist = data?.playlist ?? [];
  }

  // ─── CHAT METHODS ⭐ ───
  addChatMessage(msg: ChatMessage): void {
    // Add to rolling buffer
    this.chatBuffer.push(msg);
    if (this.chatBuffer.length > MAX_CHAT_BUFFER) {
      this.chatBuffer = this.chatBuffer.slice(-MAX_CHAT_BUFFER);
    }

    // Add to unsaved (for DB flush)
    this.unsavedChats.push(msg);
  }

  getRecentChats(limit = 100): ChatMessage[] {
    return this.chatBuffer.slice(-limit);
  }

  mergeChats(messages: ChatMessage[]): void {
    const merged = new Map<string, ChatMessage>();
    for (const message of [...this.chatBuffer, ...messages]) {
      merged.set(`${message.timestamp}:${message.userId}:${message.message}`, message);
    }
    this.chatBuffer = [...merged.values()]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_CHAT_BUFFER);
  }

  getUnsavedChats(): ChatMessage[] {
    return [...this.unsavedChats];
  }

  clearUnsavedChats(): void {
    this.unsavedChats = [];
    this.lastDbFlush = Date.now();
  }

  shouldFlushToDb(): boolean {
    // Flush every 5 minutes OR if unsaved > 100
    const timeSince = Date.now() - this.lastDbFlush;
    return (
      this.unsavedChats.length > 0 &&
      (timeSince > 5 * 60 * 1000 || this.unsavedChats.length >= 100)
    );
  }

  // ─── PARTICIPANTS ───
  addParticipant(p: ParticipantData): void {
    this.participants.set(p.userId, p);
    this.socketToUser.set(p.socketId, p.userId);
  }

  removeParticipantBySocket(socketId: string): ParticipantData | null {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return null;
    const p = this.participants.get(userId) || null;
    this.participants.delete(userId);
    this.socketToUser.delete(socketId);
    this.moderatorRequests.delete(userId);
    return p;
  }

  removeParticipantByUserId(userId: string): ParticipantData | null {
    const p = this.participants.get(userId);
    if (!p) return null;
    this.participants.delete(userId);
    this.socketToUser.delete(p.socketId);
    this.moderatorRequests.delete(userId);
    return p;
  }

  getParticipant(userId: string): ParticipantData | undefined {
    return this.participants.get(userId);
  }

  getBySocket(socketId: string): ParticipantData | undefined {
    const userId = this.socketToUser.get(socketId);
    return userId ? this.participants.get(userId) : undefined;
  }

  getRole(userId: string): Role | undefined {
    return this.participants.get(userId)?.role;
  }

  isHost(userId: string): boolean {
    return this.hostId === userId || this.getRole(userId) === 'host';
  }

  canControlPlayback(userId: string): boolean {
    const role = this.getRole(userId);
    return role === 'host' || role === 'moderator';
  }

  canManageRoom(userId: string): boolean {
    return this.getRole(userId) === 'host';
  }

  canChat(userId: string): boolean {
    const role = this.getRole(userId);
    return role !== 'viewer';
  }

  markHostOffline(): void {
    this.hostOnline = false;
  }

  markHostOnline(): void {
    this.hostOnline = true;
  }

  broadcast(io: Server, event: string, payload: any, exceptSocketId?: string): void {
    const target = io.to(this.roomId);
    if (exceptSocketId) target.except(exceptSocketId).emit(event, payload);
    else target.emit(event, payload);
  }

  serializeParticipants() {
    return Array.from(this.participants.values()).map(({ socketId, ...rest }) => rest);
  }

  serializeState() {
    return {
      roomId: this.roomId,
      code: this.code,
      hostId: this.hostId,
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.currentTime,
      lastSyncAt: this.lastSyncAt,
      partyMode: this.partyMode,
      superPartyMode: this.superPartyMode,
      hostOnline: this.hostOnline,
      audioState: this.audioState,
      playlist: this.playlist,
      participants: this.serializeParticipants(),
    };
  }

  isEmpty(): boolean {
    return this.participants.size === 0;
  }
}
