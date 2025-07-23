import { Logger, createLogger } from './logger.js';

describe('Logger', () => {
  it('should create logger instance', () => {
    const logger = createLogger();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log messages', () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const logger = createLogger();
    
    logger.info('test message');
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
