export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export function createLogger(opts: { quiet?: boolean; json?: boolean } = {}): Logger {
  const silent = opts.quiet || opts.json;
  const noop = () => {};
  return {
    info: silent ? noop : console.log,
    warn: silent ? noop : console.warn,
    error: console.error,
  };
}
