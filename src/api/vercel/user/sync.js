// src/api/vercel/user/sync.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB, getDatabaseStatus } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

const TIMEOUT_MS = 8000;
const DB_OPERATION_TIMEOUT = 5000;

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
};

const createResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
};

async function handleSync(request) {
  // Auth check
  const authHeader = request.headers['authorization'] || 
                    request.headers.authorization || 
                    (request.headers.get && request.headers.get('authorization'));

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];
  
  // Connect to DB
  const db = await connectDB();
  if (!db.readyState) {
    throw new Error('Database connection failed');
  }

  // Verify token first
  const decoded = await clerkClient.verifyToken(token);
  if (!decoded?.sub) {
    throw new Error('Invalid token: missing sub claim');
  }

  // Then get user data
  const clerkUser = await clerkClient.users.getUser(decoded.sub);
  if (!clerkUser) {
    throw new Error('Could not fetch Clerk user data');
  }

  // Get primary email with fallback
  const primaryEmail = clerkUser.emailAddresses.find(email => 
    email.id === clerkUser.primaryEmailAddressId
  )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    throw new Error('User has no email address');
  }

  // Get user data with fallbacks
  const userData = {
    clerkId: decoded.sub,
    email: primaryEmail,
    // Use username if first/last name not available
    firstName: clerkUser.firstName || clerkUser.username?.split(' ')[0] || null,
    lastName: clerkUser.lastName || clerkUser.username?.split(' ').slice(1).join(' ') || null,
    lastLoginAt: new Date()
  };

  console.log('Processing user data:', {
    clerkId: userData.clerkId,
    email: userData.email,
    hasFirstName: !!userData.firstName,
    hasLastName: !!userData.lastName
  });

  // Update/Create user with timeout and handle missing fields
  const user = await User.findOneAndUpdate(
    { clerkId: decoded.sub },
    {
      $set: {
        email: userData.email,
        lastLoginAt: userData.lastLoginAt,
        ...(userData.firstName && { firstName: userData.firstName }),
        ...(userData.lastName && { lastName: userData.lastName })
      }
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true,
      maxTimeMS: DB_OPERATION_TIMEOUT,
      setDefaultsOnInsert: true
    }
  );

  return createResponse({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      lastSync: new Date().toISOString()
    }
  });
}

export default async function handler(request) {
  const startTime = Date.now();
  console.log('Sync request started:', {
    method: request.method,
    url: request.url,
    timestamp: new Date().toISOString()
  });

  if (request.method === 'OPTIONS') {
    return createResponse(null, 204);
  }

  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT_MS)
    );

    const result = await Promise.race([
      handleSync(request),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    console.log('Sync completed:', {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error) {
    console.error('Sync error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    const status = error.message.includes('timeout') ? 504 
      : error.message.includes('auth') ? 401 
      : error.status || 500;

    return createResponse({
      success: false,
      error: error.message,
      code: error.code || 'SYNC_ERROR',
      retryable: status >= 500 || status === 429
    }, status);
  }
}

export const config = {
  api: {
    bodyParser: true
  }
};