const CLERK_API_URL = 'https://api.clerk.com/v1';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

export async function validateAuth(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return null;
    }

    if (!CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY is not defined');
    }

    const response = await fetch(`${CLERK_API_URL}/sessions/${token}`, {
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Clerk API error:', await response.text());
      return null;
    }

    const session = await response.json();
    return {
      user: {
        id: session.userId,
        sessionId: session.id
      }
    };
  } catch (error) {
    console.error('Auth validation error:', error);
    return null;
  }
}
