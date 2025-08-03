// Logger utility for consistent logging across the extension

export function logInfo(message, data = {}) {
  const timestamp = new Date().toISOString();
  if (Object.keys(data).length > 0) {
    console.log(`[${timestamp}] [INFO] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [INFO] ${message}`);
  }
}

export function logError(message, error = null) {
  const timestamp = new Date().toISOString();
  if (error) {
    console.error(`[${timestamp}] [ERROR] ${message}`, error);
  } else {
    console.error(`[${timestamp}] [ERROR] ${message}`);
  }
}

export function logWarning(message, data = {}) {
  const timestamp = new Date().toISOString();
  if (Object.keys(data).length > 0) {
    console.warn(`[${timestamp}] [WARN] ${message}`, data);
  } else {
    console.warn(`[${timestamp}] [WARN] ${message}`);
  }
}

export function logDebug(message, data = {}) {
  // Only log debug messages in development
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toISOString();
    if (Object.keys(data).length > 0) {
      console.debug(`[${timestamp}] [DEBUG] ${message}`, data);
    } else {
      console.debug(`[${timestamp}] [DEBUG] ${message}`);
    }
  }
}
