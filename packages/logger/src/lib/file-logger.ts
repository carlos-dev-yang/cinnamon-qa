import { promises as fs } from 'fs';
import { dirname } from 'path';
import { LogEntry, IFileLogger } from './types.js';

export class FileLogger implements IFileLogger {
  private filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async write(entry: LogEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.writeToFile(entry));
    return this.writeQueue;
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      const logLine = this.formatLogEntry(entry);
      await fs.appendFile(this.filePath, logLine + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    const dir = dirname(this.filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? `[${entry.context}]` : '';
    const message = entry.message;
    
    let logLine = `${timestamp} [${level}] ${context} ${message}`;
    
    if (entry.data) {
      const dataStr = this.formatData(entry.data);
      if (dataStr) {
        logLine += ` | ${dataStr}`;
      }
    }
    
    return logLine;
  }

  private formatData(data: any): string {
    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (data instanceof Error) {
      return `${data.name}: ${data.message} | Stack: ${data.stack?.replace(/\n/g, ' | ')}`;
    }

    try {
      return JSON.stringify(data);
    } catch (error) {
      return String(data);
    }
  }
}