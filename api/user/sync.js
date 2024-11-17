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
    return { userId: data.sub };
  } catch (error) {
    console.error('[Auth] Error:', error);
    return null;
  }
}

async function getClerkUser(userId) {
  try {
    const response = await fetch(`${CLERK_API_URL}/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data from Clerk');
    }

    const data = await response.json();
    return {
      userId: data.id,
      email: data.email_addresses?.[0]?.email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      imageUrl: data.image_url,
      lastSignInAt: data.last_sign_in_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('[Clerk] Error fetching user:', error);
    throw error;
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

    // Get user data from Clerk
    const clerkUser = await getClerkUser(auth.userId);
    
    // Sync user data with database
    const userData = {
      ...clerkUser,
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
        query: { userId: auth.userId },
        update: {
          $set: userData,
          $setOnInsert: {
            createdAt: new Date().toISOString()
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to sync user data');
    }

    // Get the updated user data from database
    const userResponse = await fetch(`${MONGODB_URI}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection: 'users',
        action: 'findOne',
        query: { userId: auth.userId }
      })
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user data');
    }

    const { data: user } = await userResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          ...user,
          isNew: user.createdAt === user.lastSyncedAt
        }
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        } 
      }
    );
  } catch (error) {
    console.error('[User Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: error.status || 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        } 
      }
    );
  }
}