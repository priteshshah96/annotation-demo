// Monitoring and Performance Tracking Utility

class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.errors = new Map();
    this.performanceMarks = new Map();
  }

  // Error tracking
  trackError(error, context) {
    const timestamp = Date.now();
    const errorKey = `${context}_${timestamp}`;
    
    this.errors.set(errorKey, {
      error,
      context,
      timestamp,
      stack: error.stack,
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date(timestamp).toISOString()
      }
    });

    // Clean old errors (keep last 100)
    if (this.errors.size > 100) {
      const oldestKey = Array.from(this.errors.keys())[0];
      this.errors.delete(oldestKey);
    }

    console.error(`[${context}] Error:`, error);
    return errorKey;
  }

  // Performance tracking
  startTimer(operation) {
    this.performanceMarks.set(operation, performance.now());
  }

  endTimer(operation) {
    const startTime = this.performanceMarks.get(operation);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(operation);

    // Track metrics
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        count: 0,
        totalDuration: 0,
        min: Infinity,
        max: -Infinity,
        average: 0
      });
    }

    const metric = this.metrics.get(operation);
    metric.count++;
    metric.totalDuration += duration;
    metric.min = Math.min(metric.min, duration);
    metric.max = Math.max(metric.max, duration);
    metric.average = metric.totalDuration / metric.count;

    console.log(`[Performance] ${operation}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  // Health check
  async checkHealth() {
    const checks = {
      mongodb: await this.checkMongoDB(),
      auth: await this.checkAuth(),
      api: await this.checkAPI()
    };

    const isHealthy = Object.values(checks).every(check => check.status === 'healthy');
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks
    };
  }

  async checkMongoDB() {
    try {
      const response = await fetch('/api/vercel/health/db');
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        latency: await this.measureLatency('/api/vercel/health/db')
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkAuth() {
    try {
      const response = await fetch('/api/vercel/health/auth');
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        latency: await this.measureLatency('/api/vercel/health/auth')
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkAPI() {
    try {
      const response = await fetch('/api/vercel/health');
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        latency: await this.measureLatency('/api/vercel/health')
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async measureLatency(endpoint) {
    const start = performance.now();
    try {
      await fetch(endpoint);
      return performance.now() - start;
    } catch (error) {
      return null;
    }
  }

  // Get performance metrics
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  // Get recent errors
  getRecentErrors(context = null, limit = 10) {
    const errors = Array.from(this.errors.entries())
      .sort(([, a], [, b]) => b.timestamp - a.timestamp);
    
    if (context) {
      return errors
        .filter(([key]) => key.startsWith(context))
        .slice(0, limit);
    }
    
    return errors.slice(0, limit);
  }

  // Clear metrics
  clearMetrics() {
    this.metrics.clear();
    this.performanceMarks.clear();
  }

  // Clear errors
  clearErrors() {
    this.errors.clear();
  }
}

export const monitor = new MonitoringService();

// Performance measurement decorator
export function measurePerformance(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args) {
    const operationName = `${target.constructor.name}.${propertyKey}`;
    monitor.startTimer(operationName);
    
    try {
      const result = await originalMethod.apply(this, args);
      return result;
    } finally {
      monitor.endTimer(operationName);
    }
  };

  return descriptor;
}

// Error boundary component
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    monitor.trackError(error, 'ErrorBoundary');
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong.</h2>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
