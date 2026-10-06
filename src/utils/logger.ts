const colors = {
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
  debug: '\x1b[35m',   // magenta
  reset: '\x1b[0m',
};

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (msg: string, ...args: any[]) =>
    console.log(`${colors.info}[INFO]${colors.reset} ${timestamp()} — ${msg}`, ...args),

  warn: (msg: string, ...args: any[]) =>
    console.warn(`${colors.warn}[WARN]${colors.reset} ${timestamp()} — ${msg}`, ...args),

  error: (msg: string, ...args: any[]) =>
    console.error(`${colors.error}[ERROR]${colors.reset} ${timestamp()} — ${msg}`, ...args),

  debug: (msg: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${colors.debug}[DEBUG]${colors.reset} ${timestamp()} — ${msg}`, ...args);
    }
  },
};