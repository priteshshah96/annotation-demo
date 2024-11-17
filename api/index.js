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
    await connectDB();
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

    return new Response(
      JSON.stringify({ 
        success: true,
        user: auth.user 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
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
