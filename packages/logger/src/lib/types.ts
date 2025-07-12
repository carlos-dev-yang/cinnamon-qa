export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
}

export interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  enableColors?: boolean;
  dateFormat?: string;
  context?: string;
}

export interface ILogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
  log(level: LogLevel, message: string, data?: any): void;
}

export interface IConsoleFormatter {
  format(entry: LogEntry): string;
}

export interface IFileLogger {
  write(entry: LogEntry): Promise<void>;
}