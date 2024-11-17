export async function validateToken(token) {
  try {
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
    return session.userId;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}
