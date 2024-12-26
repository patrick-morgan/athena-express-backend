type LogLevel = "debug" | "info" | "warn" | "error";

interface LogMetadata {
  route?: string;
  articleId?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private static formatMessage(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata
  ): string {
    const timestamp = new Date().toISOString();
    const metadataStr = metadata
      ? ` | metadata: ${JSON.stringify(metadata)}`
      : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metadataStr}`;
  }

  static debug(message: string, metadata?: LogMetadata) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatMessage("debug", message, metadata));
    }
  }

  static info(message: string, metadata?: LogMetadata) {
    console.info(this.formatMessage("info", message, metadata));
  }

  static warn(message: string, metadata?: LogMetadata) {
    console.warn(this.formatMessage("warn", message, metadata));
  }

  static error(message: string, error?: Error, metadata?: LogMetadata) {
    const errorDetails = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...metadata,
        }
      : metadata;

    console.error(this.formatMessage("error", message, errorDetails));
  }

  static apiRequest(route: string, method: string, metadata?: LogMetadata) {
    this.info(`API ${method} ${route}`, { route, method, ...metadata });
  }

  static apiResponse(
    route: string,
    statusCode: number,
    responseTime: number,
    metadata?: LogMetadata
  ) {
    this.info(`API Response ${route}`, {
      route,
      statusCode,
      responseTime: `${responseTime}ms`,
      ...metadata,
    });
  }
}

export default Logger;
