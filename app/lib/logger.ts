interface LogContext {
  userId?: string;
  threadId?: string;
  action?: string;
  [key: string]: any;
}

export class SecureLogger {
  private static sanitizeForLog(data: any): any {
    if (typeof data === "string") {
      return data.length > 100 ? `${data.substring(0, 100)}...` : data;
    }

    if (typeof data === "object" && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Never log sensitive fields
        if (["password", "token", "apiKey", "content"].includes(key)) {
          sanitized[key] = "[REDACTED]";
        } else if (key === "userId") {
          sanitized[key] =
            typeof value === "string" ? value.substring(0, 8) + "..." : value;
        } else {
          sanitized[key] = this.sanitizeForLog(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  static info(message: string, context?: LogContext) {
    console.log(`ℹ️ ${message}`, this.sanitizeForLog(context));
  }

  static error(message: string, error: Error, context?: LogContext) {
    console.error(`❌ ${message}`, {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      ...this.sanitizeForLog(context),
    });
  }

  static warn(message: string, context?: LogContext) {
    console.warn(`⚠️ ${message}`, this.sanitizeForLog(context));
  }

  static debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === "development") {
      console.debug(`🐛 ${message}`, this.sanitizeForLog(context));
    }
  }

  static success(message: string, context?: LogContext) {
    console.log(`✅ ${message}`, this.sanitizeForLog(context));
  }
}
