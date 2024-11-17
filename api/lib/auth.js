// Edge-compatible authentication utilities
const CLERK_API_URL = 'https://api.clerk.dev/v1';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

/**
 * Validates authentication using Clerk's JWT verification
 * @param {Request} req - Edge API request object
 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
 */
export async function validateAuth(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      console.warn('[Auth] No token provided');
      return null;
    }

    if (!CLERK_SECRET_KEY) {
      console.error('[Auth] CLERK_SECRET_KEY is not defined');
      throw new Error('Server configuration error');
    }

    const response = await fetch(`${CLERK_API_URL}/jwt/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jwt: token })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Auth] JWT verification failed:', error);
      return null;
    }

    const data = await response.json();
    return { user: data.sub };
  } catch (error) {
    console.error('[Auth] Error:', error);
    return null;
  }
}

/**
 * Creates an Edge API response for authentication errors
 * @param {Error} error - Error object
 * @param {number} status - HTTP status code
 * @returns {Response} Edge API response
 */
export function createAuthResponse(error, status = 401) {
  return new Response(
    JSON.stringify({
      error: error.message || 'Authentication failed',
      code: error.code || 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    }),
    { 
      status,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}
