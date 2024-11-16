// src/api/vercel/user/sync.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB, getDatabaseStatus } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

const TIMEOUT_MS = 8000; // 8 second timeout
const DB_OPERATION_TIMEOUT = 5000; // 5 second DB operation timeout

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

export default async function handler(request) {
  const startTime = Date.now();
  console.log('Sync request started:', {
    method: request.method,
    url: request.url,
    timestamp: new Date().toISOString()
  });

  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT_MS);
  });

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return createResponse(null, 204);
  }

  try {
    // Race between the actual operation and timeout
    const result = await Promise.race([
      handleSync(request),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;
    console.log('Sync completed successfully:', {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Sync error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    const status = error.message.includes('timeout') ? 504 
      : error.message.includes('auth') ? 401 
      : error.status || 500;

    return createResponse({
      success: false,
      error: error.message,
      code: error.code || 'SYNC_ERROR',
      retryable: status >= 500 || status === 429,
      timestamp: new Date().toISOString()
    }, status);
  }
}

async function handleSync(request) {
  // Auth check with enhanced header handling
  const authHeader = request.headers['authorization'] || 
                    request.headers.authorization || 
                    (request.headers.get && request.headers.get('authorization'));

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  // Connect to DB with timeout
  const connectPromise = connectDB();
  const dbConnection = await Promise.race([
    connectPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), DB_OPERATION_TIMEOUT)
    )
  ]);

  if (!dbConnection.readyState) {
    throw new Error('Database connection failed');
  }

  // Token verification and user fetch
  const token = authHeader.split(' ')[1];
  const [decoded, clerkUser] = await Promise.all([
    clerkClient.verifyToken(token),
    clerkClient.users.getUser(decoded?.sub)
  ]);

  if (!decoded?.sub) {
    throw new Error('Invalid token: missing sub claim');
  }

  const primaryEmail = clerkUser.emailAddresses.find(email => 
    email.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!primaryEmail) {
    throw new Error('User has no primary email address');
  }

  // Update/Create user with timeout
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
      runValidators: true,
      maxTimeMS: DB_OPERATION_TIMEOUT
    }
  );

  return createResponse({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      lastSync: new Date().toISOString()
    }
  });
}

export const config = {
  api: {
    bodyParser: true
  }
};