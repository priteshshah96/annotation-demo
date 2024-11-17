export async function validateAuth(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return null;
    }

    const response = await fetch('https://api.clerk.dev/v1/session', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
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
