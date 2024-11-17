// Edge-compatible health check handler
const CLERK_API_URL = 'https://api.clerk.dev/v1';
const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

async function validateAuth(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      console.warn('[Auth] No token provided');
      return null;
    }

    const response = await fetch(`${CLERK_API_URL}/jwt/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jwt: token })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    return { user: data.sub };
  } catch (error) {
    console.error('[Auth] Error:', error);
    return null;
  }
}

async function checkMongoDB() {
  try {
    const response = await fetch(`${MONGODB_URI}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection: 'health',
        action: 'ping'
      })
    });

    if (!response.ok) {
      throw new Error('Database health check failed');
    }

    return true;
  } catch (error) {
    console.error('[Health] MongoDB Error:', error);
    return false;
  }
}

async function checkAuth() {
  try {
    const response = await fetch(`${CLERK_API_URL}/jwt/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jwt: 'test' })
    });

    // We expect this to fail with 401, but the service should be responsive
    return response.status === 401;
  } catch (error) {
    console.error('[Health] Auth Error:', error);
    return false;
  }
}

export default async function handler(req) {
  try {
    if (req.method !== 'GET') {
      throw new Error('Method not allowed', 405);
    }

    const [dbHealth, authHealth] = await Promise.all([
      checkMongoDB(),
      checkAuth()
    ]);

    const status = dbHealth && authHealth ? 200 : 503;
    const health = {
      status: status === 200 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth ? 'up' : 'down'
        },
        auth: {
          status: authHealth ? 'up' : 'down'
        }
      }
    };

    return new Response(
      JSON.stringify(health),
      { 
        status,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate'
        }
      }
    );
  } catch (error) {
    console.error('[Health] Error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
