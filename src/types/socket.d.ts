import { JwtPayload } from '../utils/jwt';
import { Role } from '../db/models/Room.model';

export interface SocketUser extends JwtPayload {
  role?: Role;
  roomId?: string;
}

declare module 'socket.io' {
  interface Socket {
    user?: SocketUser;
  }
}

export {};