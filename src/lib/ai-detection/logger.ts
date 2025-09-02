export interface Logger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export class ConsoleLogger implements Logger {
  private prefix: string;
  constructor(prefix = "AI") { this.prefix = prefix; }
  info(message: string, meta?: unknown) { try { console.info(`[${this.prefix}] ${message}`, meta ?? ""); } catch {} }
  warn(message: string, meta?: unknown) { try { console.warn(`[${this.prefix}] ${message}`, meta ?? ""); } catch {} }
  error(message: string, meta?: unknown) { try { console.error(`[${this.prefix}] ${message}`, meta ?? ""); } catch {} }
}
