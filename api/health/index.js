import { connectDB } from '../lib/db';
import { validateAuth } from '../lib/auth';

export const config = {
  // Removed the runtime configuration as per the latest guidelines
  // runtime: 'nodejs',
  regions: ['iad1'],
};

class HealthError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'HealthError';
    this.status = status;
  }
}

async function checkMongoDB() {
  try {
    const startTime = Date.now();
    await connectDB();
    return {
      status: 'healthy',
      latency: Date.now() - startTime
    };
  } catch (error) {
    console.error('[Health] MongoDB check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

async function checkAuth(req) {
  try {
    const startTime = Date.now();
    await validateAuth(req);
    return {
      status: 'healthy',
      latency: Date.now() - startTime
    };
  } catch (error) {
    console.error('[Health] Auth check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    if (req.method !== 'GET') {
      throw new HealthError('Method not allowed', 405);
    }

    const checks = {
      mongodb: await checkMongoDB(),
      auth: req.headers.authorization ? await checkAuth(req) : { status: 'skipped' }
    };

    const isHealthy = Object.values(checks).every(
      check => check.status === 'healthy' || check.status === 'skipped'
    );

    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      latency: Date.now() - startTime
    };

    res.status(isHealthy ? 200 : 503).json(response);
  } catch (error) {
    console.error('[Health] Check failed:', error);
    res.status(error.status || 500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
