/**
 * Performance Monitoring Utility
 * 
 * Provides tools to measure and log performance metrics for debugging slow operations
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  details?: any;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number[]> = new Map();
  private enabled: boolean = true;

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Start timing an operation
   */
  start(name: string) {
    if (!this.enabled) return;
    const list = this.timers.get(name) || [];
    list.push(performance.now());
    this.timers.set(name, list);
  }

  /**
   * End timing an operation and log the result
   */
  end(name: string, details?: any) {
    if (!this.enabled) return;
    
    const list = this.timers.get(name);
    const startTime = list && list.length > 0 ? list.pop() : undefined;
    if (startTime === undefined) {
      console.warn(`[PerformanceMonitor] No start time found for: ${name}`);
      return;
    }

    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      details,
    };

    this.metrics.push(metric);
    if (list && list.length > 0) {
      this.timers.set(name, list);
    } else {
      this.timers.delete(name);
    }

    // Log if duration exceeds threshold
    const threshold = 100; // ms
    const isAborted = details && details.aborted === true;
    
    if (isAborted) {
      // Don't log aborted requests as warnings (reduces StrictMode noise)
      console.log(
        `[Performance] ${name} took ${duration.toFixed(2)}ms`,
        details || ''
      );
    } else if (duration > threshold) {
      console.warn(
        `[Performance] ${name} took ${duration.toFixed(2)}ms`,
        details || ''
      );
    } else {
      console.log(
        `[Performance] ${name} took ${duration.toFixed(2)}ms`,
        details || ''
      );
    }

    return metric;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(name: string, operation: () => Promise<T>, details?: any): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    this.start(name);
    try {
      const result = await operation();
      this.end(name, details);
      return result;
    } catch (error) {
      this.end(name, { ...details, error: true });
      throw error;
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary grouped by operation name
   */
  getSummary() {
    const summary: Record<string, { count: number; totalDuration: number; avgDuration: number; maxDuration: number }> = {};

    this.metrics.forEach(metric => {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          maxDuration: 0,
        };
      }

      const s = summary[metric.name];
      s.count++;
      s.totalDuration += metric.duration;
      s.maxDuration = Math.max(s.maxDuration, metric.duration);
      s.avgDuration = s.totalDuration / s.count;
    });

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const summary = this.getSummary();
    console.group('[Performance Summary]');
    Object.entries(summary).forEach(([name, stats]) => {
      console.log(
        `${name}: ${stats.count} calls, avg ${stats.avgDuration.toFixed(2)}ms, max ${stats.maxDuration.toFixed(2)}ms`
      );
    });
    console.groupEnd();
  }
}

// Global instance
export const perfMonitor = new PerformanceMonitor();

// Enable in development
if (typeof window !== 'undefined') {
  (window as any).perfMonitor = perfMonitor;
}
