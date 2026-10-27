type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (/secret|key|token|password/i.test(value)) return "[REDACTED]";
    return value;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/secret|key|token|password/i.test(k)) out[k] = "[REDACTED]";
      else out[k] = redact(v);
    }
    return out;
  }
  return value;
}

export interface LogContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export class Logger {
  constructor(private readonly minLevel: Level = "info", private readonly base: LogContext = {}) {}

  private emit(level: Level, msg: string, ctx?: LogContext) {
    if (LEVELS[level] < LEVELS[this.minLevel]) return;
    const entry = {
      level,
      time: new Date().toISOString(),
      msg,
      ...this.base,
      ...(ctx ? redact(ctx) as LogContext : {}),
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  }

  debug(msg: string, ctx?: LogContext) { this.emit("debug", msg, ctx); }
  info(msg: string, ctx?: LogContext) { this.emit("info", msg, ctx); }
  warn(msg: string, ctx?: LogContext) { this.emit("warn", msg, ctx); }
  error(msg: string, ctx?: LogContext) { this.emit("error", msg, ctx); }

  child(ctx: LogContext): Logger {
    return new Logger(this.minLevel, { ...this.base, ...ctx });
  }
}

export function createLogger(minLevel: Level = "info", base?: LogContext): Logger {
  return new Logger(minLevel, base);
}
