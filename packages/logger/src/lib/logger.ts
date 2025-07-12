import { LogLevel, LogEntry, LoggerConfig, ILogger } from './types.js';
import { ConsoleFormatter } from './console-formatter.js';
import { FileLogger } from './file-logger.js';

export class Logger implements ILogger {
  private config: Required<LoggerConfig>;
  private consoleFormatter: ConsoleFormatter;
  private fileLogger?: FileLogger;

  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFile: false,
      filePath: './logs/app.log',
      enableColors: true,
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      context: '',
      ...config,
    };

    this.consoleFormatter = new ConsoleFormatter(
      this.config.enableColors,
      this.config.dateFormat
    );

    if (this.config.enableFile) {
      this.fileLogger = new FileLogger(this.config.filePath);
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      context: this.config.context,
    };

    this.writeLog(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevelValue = Logger.LOG_LEVELS[this.config.level];
    const logLevelValue = Logger.LOG_LEVELS[level];
    return logLevelValue >= currentLevelValue;
  }

  private writeLog(entry: LogEntry): void {
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    if (this.config.enableFile && this.fileLogger) {
      this.fileLogger.write(entry);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const formatted = this.consoleFormatter.format(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setContext(context: string): void {
    this.config.context = context;
  }

  child(context: string): Logger {
    const childConfig = {
      ...this.config,
      context: this.config.context 
        ? `${this.config.context}:${context}` 
        : context,
    };
    return new Logger(childConfig);
  }
}

export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}
