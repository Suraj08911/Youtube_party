import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name required').max(60, 'Room name too long'),
  // ⭐ Playlist OPTIONAL — agar khali hai toh bhi room create hoga
  playlist: z
    .array(
      z.object({
        label: z.string().min(1, 'Label required').max(80),
        videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid YouTube ID'),
      })
    )
    .max(100, 'Max 100 videos')
    .optional()
    .default([]),
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .length(6, 'Room code must be 6 characters')
    .regex(/^[A-Z0-9]+$/i, 'Invalid code format'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;