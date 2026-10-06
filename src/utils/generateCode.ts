import { env } from '../config/env';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed I, O, 0, 1 to avoid confusion

export const generateRoomCode = (): string => {
  let code = '';
  for (let i = 0; i < env.ROOM_CODE_LENGTH; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
};