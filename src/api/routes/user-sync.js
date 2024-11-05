// src/api/routes/user-sync.js
import { bulkSyncUsers } from '../../middleware/userSync';
import { validateAuth } from '../middleware/auth';

export async function POST(req) {
  try {
    // Only allow authenticated admin users to trigger sync
    const session = await validateAuth(req);
    if (!session?.auth?.isAdmin) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: 'Admin access required'
      }), { status: 403 });
    }

    const results = await bulkSyncUsers();
    
    return new Response(JSON.stringify({
      success: true,
      results
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('User sync API error:', error);
    return new Response(JSON.stringify({
      error: 'Sync failed',
      details: error.message
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

export async function GET(req) {
  try {
    const session = await validateAuth(req);
    if (!session?.auth?.isAdmin) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: 'Admin access required'
      }), { status: 403 });
    }

    // Get sync status
    const clerkUsers = await clerk.users.getUserList();
    const mongoUsers = await User.find({});

    const status = {
      clerkUsersCount: clerkUsers.length,
      mongoUsersCount: mongoUsers.length,
      syncStatus: clerkUsers.length === mongoUsers.length ? 'synchronized' : 'out-of-sync',
      lastSyncCheck: new Date().toISOString()
    };

    return new Response(JSON.stringify({
      success: true,
      status
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Sync status check error:', error);
    return new Response(JSON.stringify({
      error: 'Status check failed',
      details: error.message
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}