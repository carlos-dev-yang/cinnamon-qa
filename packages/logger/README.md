# @cinnamon-qa/logger

A flexible logging library with console and file output support, featuring colored output, contextual logging, and configurable log levels.

## Features

- **Multiple log levels**: debug, info, warn, error
- **Dual output**: Console and file logging
- **Colored console output**: Enhanced readability with color-coded log levels
- **Contextual logging**: Add context to identify log sources
- **Child loggers**: Create scoped loggers with inherited context
- **Configurable**: Flexible configuration options
- **TypeScript**: Full TypeScript support with type definitions

## Installation

```bash
npm install @cinnamon-qa/logger
```

## Quick Start

```typescript
import { createLogger } from '@cinnamon-qa/logger';

// Basic usage
const logger = createLogger();
logger.info('Application started');
logger.warn('This is a warning');
logger.error('An error occurred');

// With configuration
const logger = createLogger({
  level: 'debug',
  enableFile: true,
  filePath: './logs/app.log',
  context: 'MyApp'
});

logger.debug('Debug message');
logger.info('Info message', { userId: 123 });
```

## Configuration Options

```typescript
interface LoggerConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';    // Minimum log level (default: 'info')
  enableConsole?: boolean;                          // Enable console output (default: true)
  enableFile?: boolean;                            // Enable file output (default: false)
  filePath?: string;                               // Log file path (default: './logs/app.log')
  enableColors?: boolean;                          // Enable colored console output (default: true)
  dateFormat?: string;                             // Date format string (default: 'YYYY-MM-DD HH:mm:ss')
  context?: string;                                // Context identifier (default: '')
}
```

## Usage Examples

### Basic Logging

```typescript
import { Logger, createLogger } from '@cinnamon-qa/logger';

const logger = createLogger();

logger.debug('Debug information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error message');

// With additional data
logger.info('User action', { 
  userId: 123, 
  action: 'login', 
  timestamp: Date.now() 
});
```

### File Logging

```typescript
const logger = createLogger({
  enableFile: true,
  filePath: './logs/application.log',
  level: 'debug'
});

logger.info('This will be written to both console and file');
```

### Contextual Logging

```typescript
const logger = createLogger({ context: 'DatabaseService' });
logger.info('Connection established'); // [DatabaseService] Connection established

// Create child loggers
const userLogger = logger.child('UserModule');
userLogger.info('User created'); // [DatabaseService:UserModule] User created
```

### Different Log Levels

```typescript
// Only log warnings and errors
const logger = createLogger({ level: 'warn' });

logger.debug('Not logged');  // Ignored
logger.info('Not logged');   // Ignored
logger.warn('Logged');       // Visible
logger.error('Logged');      // Visible
```

### Custom Configuration

```typescript
const logger = createLogger({
  level: 'debug',
  enableConsole: true,
  enableFile: true,
  filePath: './logs/debug.log',
  enableColors: false,
  dateFormat: 'DD/MM/YYYY HH:mm:ss',
  context: 'API'
});
```

## API Reference

### Logger Class

#### Methods

- `debug(message: string, data?: any): void` - Log debug message
- `info(message: string, data?: any): void` - Log info message  
- `warn(message: string, data?: any): void` - Log warning message
- `error(message: string, data?: any): void` - Log error message
- `log(level: LogLevel, message: string, data?: any): void` - Log with specific level
- `setLevel(level: LogLevel): void` - Change log level
- `setContext(context: string): void` - Change context
- `child(context: string): Logger` - Create child logger

### Functions

- `createLogger(config?: LoggerConfig): Logger` - Create new logger instance

## Development

### Building

```bash
nx build logger
```

### Running Tests

```bash
nx test logger
```

### Type Checking

```bash
nx run logger:type-check
```
