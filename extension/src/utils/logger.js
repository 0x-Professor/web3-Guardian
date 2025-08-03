// Logger utility for the Web3 Guardian extension

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Default log level (can be overridden in development)
let logLevel = process.env.NODE_ENV === 'development' ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

/**
 * Set the log level
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'NONE'} level - The log level to set
 */
const setLogLevel = (level) => {
  if (level in LOG_LEVELS) {
    logLevel = LOG_LEVELS[level];
  } else {
    console.warn(`Invalid log level: ${level}. Using default.`);
  }
};

/**
 * Log a debug message
 * @param {string} message - The message to log
 * @param {*} [data] - Additional data to log
 */
const debug = (message, data) => {
  if (logLevel <= LOG_LEVELS.DEBUG) {
    console.debug(`[DEBUG] ${message}`, data || '');
  }
};

/**
 * Log an info message
 * @param {string} message - The message to log
 * @param {*} [data] - Additional data to log
 */
const info = (message, data) => {
  if (logLevel <= LOG_LEVELS.INFO) {
    console.log(`[INFO] ${message}`, data || '');
  }
};

/**
 * Log a warning message
 * @param {string} message - The message to log
 * @param {*} [data] - Additional data to log
 */
const warn = (message, data) => {
  if (logLevel <= LOG_LEVELS.WARN) {
    console.warn(`[WARN] ${message}`, data || '');
  }
};

/**
 * Log an error message
 * @param {string} message - The message to log
 * @param {Error|*} [error] - The error object or additional data
 * @param {Object} [context] - Additional context about the error
 */
const error = (message, error, context = {}) => {
  if (logLevel <= LOG_LEVELS.ERROR) {
    console.error(`[ERROR] ${message}`, { error, ...context });
    
    // In production, you might want to send errors to a logging service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendToErrorTrackingService(message, error, context);
    }
  }
};

/**
 * Create a scoped logger with a specific prefix
 * @param {string} scope - The scope/component name
 * @returns {Object} A logger instance with scope prefix
 */
const createScopedLogger = (scope) => ({
  debug: (message, data) => debug(`[${scope}] ${message}`, data),
  info: (message, data) => info(`[${scope}] ${message}`, data),
  warn: (message, data) => warn(`[${scope}] ${message}`, data),
  error: (message, error, context) => 
    error(`[${scope}] ${message}`, error, context),
});

export default {
  setLogLevel,
  debug,
  info,
  warn,
  error,
  createScopedLogger,
  LOG_LEVELS,
};
