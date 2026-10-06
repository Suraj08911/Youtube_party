import type { CorsOptions } from 'cors';
import { env } from './env';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://endearing-sprinkles-c1c952.netlify.app',
];

const normalizeOrigin = (value: string): string | null => {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
};

const allowedOrigins = new Set(
  [
    ...DEFAULT_ALLOWED_ORIGINS,
    env.CLIENT_URL,
    ...env.CORS_ORIGINS,
  ]
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin !== null)
);

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Requests without an Origin header (health checks and server-to-server calls)
  // are not browser CORS requests and should continue through normal auth checks.
  if (!origin) return true;

  return allowedOrigins.has(origin);
};

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin) ? origin ?? false : false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
