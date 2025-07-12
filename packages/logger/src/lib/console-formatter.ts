import { LogEntry, IConsoleFormatter, LogLevel } from './types.js';

export class ConsoleFormatter implements IConsoleFormatter {
  private enableColors: boolean;

  constructor(enableColors = true, _dateFormat = 'YYYY-MM-DD HH:mm:ss') {
    this.enableColors = enableColors;
  }

  format(entry: LogEntry): string {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const level = this.formatLevel(entry.level);
    const context = entry.context ? `[${entry.context}]` : '';
    const message = entry.message;
    const data = entry.data ? `\n${this.formatData(entry.data)}` : '';

    return `${timestamp} ${level} ${context} ${message}${data}`;
  }

  private formatTimestamp(timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');

    const formatted = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    return this.enableColors ? `\x1b[90m${formatted}\x1b[0m` : formatted;
  }

  private formatLevel(level: LogLevel): string {
    const levelMap: Record<LogLevel, { text: string; color: string }> = {
      debug: { text: 'DEBUG', color: '\x1b[36m' }, // cyan
      info: { text: 'INFO ', color: '\x1b[32m' }, // green
      warn: { text: 'WARN ', color: '\x1b[33m' }, // yellow
      error: { text: 'ERROR', color: '\x1b[31m' }, // red
    };

    const levelInfo = levelMap[level];
    const levelText = `[${levelInfo.text}]`;

    return this.enableColors 
      ? `${levelInfo.color}${levelText}\x1b[0m`
      : levelText;
  }

  private formatData(data: any): string {
    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (data instanceof Error) {
      return `${data.name}: ${data.message}\n${data.stack}`;
    }

    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return String(data);
    }
  }
}