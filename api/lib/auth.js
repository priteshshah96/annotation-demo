const CLERK_API_URL = 'https://api.clerk.dev/v1';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

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

    // Use the JWT verify endpoint
    const response = await fetch(`${CLERK_API_URL}/jwt/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jwt: token,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Auth] Clerk API error:', errorText);
      
      // Don't throw on auth errors, just return null
      if (response.status === 401 || response.status === 404) {
        return null;
      }
      
      throw new Error('Session validation failed');
    }

    const verification = await response.json();
    if (!verification?.sub) {
      console.warn('[Auth] Invalid token data:', verification);
      return null;
    }

    return {
      user: {
        id: verification.sub,
        sessionId: verification.sid
      }
    };
  } catch (error) {
    console.error('[Auth] Validation error:', error);
    throw error; // Re-throw non-auth errors
  }
}
