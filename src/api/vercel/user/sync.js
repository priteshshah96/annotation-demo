// src/api/vercel/user/sync.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB, getDatabaseStatus } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
};

export default async function handler(request) {
  // Log request start
  console.log('Sync request started:', {
    method: request.method,
    url: request.url,
    timestamp: new Date().toISOString()
  });

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  let dbConnection = null;
  try {
    // Auth check
    const authHeader = request.headers['authorization'] || 
                  request.headers.authorization || 
                  (request.headers.get && request.headers.get('authorization'));
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Auth header missing or invalid');
      throw new Error('Missing or invalid authorization header');
    }

    // Connect to DB
    console.log('Initiating database connection...');
    dbConnection = await connectDB();
    const dbStatus = getDatabaseStatus();
    console.log('Database connection status:', dbStatus);

    // Token verification
    console.log('Verifying Clerk token...');
    const token = authHeader.split(' ')[1];
    const decoded = await clerkClient.verifyToken(token);
    
    if (!decoded?.sub) {
      throw new Error('Invalid token: missing sub claim');
    }
    console.log('Token verified for user:', decoded.sub);

    // Get Clerk user
    console.log('Fetching Clerk user data...');
    const clerkUser = await clerkClient.users.getUser(decoded.sub);
    
    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!primaryEmail) {
      throw new Error('User has no primary email address');
    }

    console.log('Found user email:', primaryEmail);

    // Update/Create user
    console.log('Upserting user in database...');
    const user = await User.findOneAndUpdate(
      { clerkId: decoded.sub },
      {
        email: primaryEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        lastLoginAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );

    console.log('User operation successful:', {
      userId: user._id,
      clerkId: decoded.sub
    });

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          lastSync: new Date().toISOString()
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    // Detailed error logging
    console.error('Sync error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      dbStatus: dbConnection ? getDatabaseStatus() : 'No connection',
      timestamp: new Date().toISOString()
    });

    // Error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        code: error.code || 'SYNC_ERROR',
        timestamp: new Date().toISOString()
      }),
      {
        status: error.status || 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

export const config = {
  api: {
    bodyParser: true
  }
};