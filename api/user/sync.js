import { validateAuth } from '../lib/auth';
import { connectDB } from '../lib/db';

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
    if (!auth || !auth.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = await connectDB();
    const user = await db.findOne('users', { userId: auth.user.id });
    
    if (!user) {
      // Create new user if doesn't exist
      await db.insertOne('users', {
        userId: auth.user.id,
        lastSync: new Date().toISOString()
      });
    } else {
      // Update existing user
      await db.updateOne(
        'users',
        { userId: auth.user.id },
        { $set: { lastSync: new Date().toISOString() } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: auth.user.id,
          lastSync: new Date().toISOString()
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Sync Error]:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}