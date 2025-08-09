import { SecureLogger } from "./logger";

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();
  private static activeTimers: Map<string, number> = new Map();

  // Start timing an operation
  static startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    this.activeTimers.set(timerId, performance.now());
    return timerId;
  }

  // End timing and record metric
  static endTimer(timerId: string, operation: string): number {
    const startTime = this.activeTimers.get(timerId);
    if (!startTime) {
      SecureLogger.warn("Timer not found", { timerId, operation });
      return 0;
    }

    const duration = performance.now() - startTime;
    this.activeTimers.delete(timerId);

    // Store metric
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(duration);

    // Keep only last 100 measurements
    if (operationMetrics.length > 100) {
      operationMetrics.shift();
    }

    SecureLogger.debug("Performance metric recorded", {
      operation,
      duration: `${duration.toFixed(2)}ms`,
    });

    return duration;
  }

  // Get performance statistics for an operation
  static getStats(operation: string) {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const sorted = [...metrics].sort((a, b) => a - b);
    const avg = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      operation,
      count: metrics.length,
      avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      p50: parseFloat(p50.toFixed(2)),
      p95: parseFloat(p95.toFixed(2)),
      p99: parseFloat(p99.toFixed(2)),
    };
  }

  // Get all performance statistics
  static getAllStats() {
    const allStats: Record<string, any> = {};
    for (const operation of this.metrics.keys()) {
      const stats = this.getStats(operation);
      if (stats) {
        allStats[operation] = stats;
      }
    }
    return allStats;
  }

  // Clear all metrics
  static clearMetrics() {
    this.metrics.clear();
    this.activeTimers.clear();
  }
}

// Higher-order function to monitor async operations
export function withPerformanceMonitoring<T extends any[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const timerId = PerformanceMonitor.startTimer(operation);
    try {
      const result = await fn(...args);
      PerformanceMonitor.endTimer(timerId, operation);
      return result;
    } catch (error) {
      PerformanceMonitor.endTimer(timerId, operation);
      SecureLogger.error(
        `Error in monitored operation: ${operation}`,
        error as Error
      );
      throw error;
    }
  };
}

// Memory usage monitoring
export class MemoryMonitor {
  private static snapshots: Array<{
    timestamp: number;
    usage: NodeJS.MemoryUsage;
  }> = [];

  static takeSnapshot() {
    const usage = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      usage,
    };

    this.snapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    SecureLogger.debug("Memory snapshot taken", {
      heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
    });

    return snapshot;
  }

  static getMemoryTrend() {
    if (this.snapshots.length < 2) {
      return null;
    }

    const recent = this.snapshots.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const heapGrowth = newest.usage.heapUsed - oldest.usage.heapUsed;
    const timeSpan = newest.timestamp - oldest.timestamp;

    return {
      heapGrowthMB: parseFloat((heapGrowth / 1024 / 1024).toFixed(2)),
      timeSpanMs: timeSpan,
      growthRateMBPerMin: parseFloat(
        (heapGrowth / 1024 / 1024 / (timeSpan / 60000)).toFixed(4)
      ),
      current: {
        heapUsedMB: parseFloat(
          (newest.usage.heapUsed / 1024 / 1024).toFixed(2)
        ),
        heapTotalMB: parseFloat(
          (newest.usage.heapTotal / 1024 / 1024).toFixed(2)
        ),
        externalMB: parseFloat(
          (newest.usage.external / 1024 / 1024).toFixed(2)
        ),
        rssMB: parseFloat((newest.usage.rss / 1024 / 1024).toFixed(2)),
      },
    };
  }

  static checkMemoryLeaks() {
    const trend = this.getMemoryTrend();
    if (!trend) return false;

    // Alert if memory growth rate exceeds 10MB per minute
    const isLeaking = trend.growthRateMBPerMin > 10;

    if (isLeaking) {
      SecureLogger.warn("Potential memory leak detected", {
        growthRateMBPerMin: trend.growthRateMBPerMin,
        currentHeapMB: trend.current.heapUsedMB,
      });
    }

    return isLeaking;
  }
}

// Rate limiting monitoring
export class RateLimitMonitor {
  private static violations: Map<string, number> = new Map();
  private static requests: Map<string, number[]> = new Map();

  static recordRequest(identifier: string) {
    const now = Date.now();

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const userRequests = this.requests.get(identifier)!;
    userRequests.push(now);

    // Keep only requests from last hour
    const oneHourAgo = now - 3600000;
    const recentRequests = userRequests.filter((time) => time > oneHourAgo);
    this.requests.set(identifier, recentRequests);
  }

  static recordViolation(identifier: string) {
    const current = this.violations.get(identifier) || 0;
    this.violations.set(identifier, current + 1);

    SecureLogger.warn("Rate limit violation", {
      identifier: identifier.substring(0, 8) + "...",
      totalViolations: current + 1,
    });
  }

  static getRequestStats(identifier: string) {
    const requests = this.requests.get(identifier) || [];
    const violations = this.violations.get(identifier) || 0;

    return {
      requestsLastHour: requests.length,
      totalViolations: violations,
    };
  }

  static getTopViolators(limit: number = 10) {
    return Array.from(this.violations.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([identifier, violations]) => ({
        identifier: identifier.substring(0, 8) + "...",
        violations,
      }));
  }
}

// Health check system
export class HealthChecker {
  private static checks: Map<string, () => Promise<boolean>> = new Map();

  static registerCheck(name: string, checkFn: () => Promise<boolean>) {
    this.checks.set(name, checkFn);
  }

  static async runHealthChecks() {
    const results: Record<
      string,
      { healthy: boolean; duration: number; error?: string }
    > = {};

    for (const [name, checkFn] of this.checks.entries()) {
      const start = performance.now();
      try {
        const healthy = await checkFn();
        const duration = performance.now() - start;
        results[name] = { healthy, duration: parseFloat(duration.toFixed(2)) };
      } catch (error) {
        const duration = performance.now() - start;
        results[name] = {
          healthy: false,
          duration: parseFloat(duration.toFixed(2)),
          error: (error as Error).message,
        };
      }
    }

    const overallHealthy = Object.values(results).every(
      (result) => result.healthy
    );

    SecureLogger.info("Health check completed", {
      overallHealthy,
      checks: Object.keys(results).length,
      results,
    });

    return {
      healthy: overallHealthy,
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }
}

// Automatic monitoring setup
export function setupMonitoring() {
  // Take memory snapshots every 5 minutes
  setInterval(
    () => {
      MemoryMonitor.takeSnapshot();
      MemoryMonitor.checkMemoryLeaks();
    },
    5 * 60 * 1000
  );

  // Log performance stats every 10 minutes
  setInterval(
    () => {
      const stats = PerformanceMonitor.getAllStats();
      if (Object.keys(stats).length > 0) {
        SecureLogger.info("Performance statistics", { stats });
      }
    },
    10 * 60 * 1000
  );

  // Register basic health checks
  HealthChecker.registerCheck("memory", async () => {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    return heapUsedMB < 1000; // Alert if heap usage exceeds 1GB
  });

  HealthChecker.registerCheck("uptime", async () => {
    return process.uptime() > 0;
  });

  SecureLogger.info("Monitoring system initialized");
}

// Export monitoring decorators
export const monitored = (operation: string) => {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timerId = PerformanceMonitor.startTimer(operation);
      try {
        const result = await originalMethod.apply(this, args);
        PerformanceMonitor.endTimer(timerId, operation);
        return result;
      } catch (error) {
        PerformanceMonitor.endTimer(timerId, operation);
        throw error;
      }
    };

    return descriptor;
  };
};
