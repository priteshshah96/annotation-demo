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

const log = (message, data = {}) => {
  console.log(`[Sync API] ${message}`, data);
};

async function handleSync(request) {
  log("Received sync request", { method: request.method });

  const authHeader = request.headers['authorization'] || 
                    request.headers.authorization || 
                    (request.headers.get && request.headers.get('authorization'));

  if (!authHeader?.startsWith('Bearer ')) {
    log("Missing or invalid authorization header");
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];
  log("Authorization token extracted");

  const db = await connectDB();
  if (!db.readyState) {
    log("Database connection failed");
    throw new Error('Database connection failed');
  }
  log("Database connected");

  const decoded = await clerkClient.verifyToken(token);
  if (!decoded?.sub) {
    log("Invalid token: missing sub claim", { token });
    throw new Error('Invalid token: missing sub claim');
  }
  log("Token verified", { sub: decoded.sub });

  const clerkUser = await clerkClient.users.getUser(decoded.sub);
  if (!clerkUser) {
    log("Failed to fetch Clerk user data", { sub: decoded.sub });
    throw new Error('Could not fetch Clerk user data');
  }
  log("Clerk user data retrieved", { clerkId: decoded.sub });

  const primaryEmail = clerkUser.emailAddresses.find(email => 
    email.id === clerkUser.primaryEmailAddressId
  )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    log("User has no email address", { clerkId: decoded.sub });
    throw new Error('User has no email address');
  }

  const userData = {
    clerkId: decoded.sub,
    email: primaryEmail,
    firstName: clerkUser.firstName || clerkUser.username?.split(' ')[0] || null,
    lastName: clerkUser.lastName || clerkUser.username?.split(' ').slice(1).join(' ') || null,
    lastLoginAt: new Date()
  };
  log("Prepared user data for sync", { userData });

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
  log("User sync operation completed", { user });

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
  log("Handling sync request", { method: request.method, url: request.url });

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
    log("Sync request completed", { duration: `${duration}ms` });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    log("Sync error", { error: error.message, duration: `${duration}ms` });

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