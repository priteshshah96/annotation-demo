const CLERK_API_URL = 'https://api.clerk.com/v1';
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

    const response = await fetch(`${CLERK_API_URL}/sessions/${token}`, {
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
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

    const session = await response.json();
    if (!session?.userId) {
      console.warn('[Auth] Invalid session data:', session);
      return null;
    }

    return {
      user: {
        id: session.userId,
        sessionId: session.id
      }
    };
  } catch (error) {
    console.error('[Auth] Validation error:', error);
    throw error; // Re-throw non-auth errors
  }
}
