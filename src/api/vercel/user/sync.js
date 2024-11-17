import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

const TIMEOUT_MS = 10000; // Increased timeout
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

// Helper to get auth token from various header formats
const getAuthToken = (request) => {
  // Handle both Headers object and plain object
  const authHeader = request.headers instanceof Headers 
    ? request.headers.get('authorization')
    : request.headers.authorization || request.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  return authHeader.split(' ')[1];
};

async function handleSync(request) {
  console.log("Starting sync process...");

  try {
    const token = getAuthToken(request);
    console.log("Token extracted, verifying...");

    // Verify token first
    const decoded = await clerkClient.verifyToken(token);
    if (!decoded?.sub) {
      throw new Error('Invalid token');
    }
    console.log("Token verified successfully");

    // Connect to database
    console.log("Connecting to database...");
    const dbPromise = connectDB();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), DB_OPERATION_TIMEOUT)
    );

    await Promise.race([dbPromise, timeoutPromise]);
    console.log("Database connected successfully");

    // Get user data from Clerk
    const clerkUser = await clerkClient.users.getUser(decoded.sub);
    if (!clerkUser) {
      throw new Error('User not found');
    }
    console.log("Clerk user data retrieved");

    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      throw new Error('No email address found');
    }

    // Update or create user with timeout
    console.log("Updating/creating user in database...");
    const updatePromise = User.findOneAndUpdate(
      { clerkId: decoded.sub },
      {
        $set: {
          email: primaryEmail,
          firstName: clerkUser.firstName || clerkUser.username?.split(' ')[0] || null,
          lastName: clerkUser.lastName || clerkUser.username?.split(' ').slice(1).join(' ') || null,
          lastLoginAt: new Date()
        }
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );

    const user = await Promise.race([
      updatePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database operation timeout')), DB_OPERATION_TIMEOUT)
      )
    ]);

    console.log("User sync completed successfully");
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
  } catch (error) {
    console.error("Sync process error:", error);
    throw error;
  }
}

export default async function handler(request) {
  console.log(`Sync API called: ${request.method}`);

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

    return result;
  } catch (error) {
    console.error('Sync error:', error);
    
    const status = error.message.includes('timeout') ? 504 
      : error.message.includes('auth') ? 401 
      : error.message.includes('database') ? 503
      : 500;

    return createResponse({
      success: false,
      error: error.message,
      code: error.code || 'SYNC_ERROR',
      timestamp: new Date().toISOString(),
      retryable: status >= 500
    }, status);
  }
}

export const config = {
  api: {
    bodyParser: true
  }
};