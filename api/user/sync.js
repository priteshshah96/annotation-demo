// Edge-compatible user sync handler
const CLERK_API_URL = 'https://api.clerk.dev/v1';
const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;

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

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const auth = await validateAuth(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sync user data with database
    const userData = {
      userId: auth.user,
      lastSyncedAt: new Date().toISOString()
    };

    const response = await fetch(`${MONGODB_URI}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection: 'users',
        action: 'upsert',
        query: { userId: auth.user },
        update: {
          $set: userData,
          $setOnInsert: {
            createdAt: new Date().toISOString()
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to sync user data');
    }

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[User Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}