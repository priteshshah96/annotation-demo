import { connectDB } from '../src/lib/db';
import { validateAuth } from '../src/lib/auth';

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const db = await connectDB();
    const auth = await validateAuth(req);
    
    if (!auth?.user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED' 
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle the request based on the path
    const url = new URL(req.url);
    const path = url.pathname.replace('/api/vercel', '');

    if (path === '/health') {
      const dbHealth = await db.findOne('health', { type: 'system' });
      return new Response(JSON.stringify({ status: 'healthy', db: dbHealth }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Example: Get user data
    const userData = await db.findOne('users', { userId: auth.user.id });

    return new Response(
      JSON.stringify({ 
        success: true,
        user: userData
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // Add other route handlers here...

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
