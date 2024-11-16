// src/api/vercel/user/sync.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';
import mongoose from 'mongoose';

// Cache for user data to reduce DB load
const USER_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  'Content-Type': 'application/json'
};

// Enhanced CORS headers for Vercel
const getCorsHeaders = () => {
  const allowedOrigins = [
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'http://localhost:5173',
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  ].filter(Boolean);

  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': allowedOrigins.join(', ')
  };
};

const createResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: getCorsHeaders()
  });
};

// Error response helper
const createErrorResponse = (error, status = 500) => {
  const traceId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.error('User sync error:', {
    traceId,
    message: error.message,
    stack: error.stack,
    code: error.code
  });

  return createResponse({
    success: false,
    error: error.message,
    code: error.code || 'SYNC_ERROR',
    traceId,
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  }, status);
};

// Cached user lookup
async function getCachedUser(clerkId) {
  const cacheKey = `user-${clerkId}`;
  const cached = USER_CACHE.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using cached user data for:', clerkId);
    return cached.user;
  }
  
  return null;
}

// Cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of USER_CACHE.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      USER_CACHE.delete(key);
    }
  }
}, CACHE_TTL);

export default async function handler(req) {
  const startTime = Date.now();
  console.log('User sync request:', {
    method: req.method,
    url: req.url,
    headers: {
      ...req.headers,
      authorization: '[REDACTED]'
    }
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders()
    });
  }

  let session = null;

  try {
    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    // Connect to database with increased timeout
    console.log('Connecting to database...');
    const db = await Promise.race([
      connectDB(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 15000)
      )
    ]);

    // Verify token
    console.log('Verifying token...');
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = await clerkClient.verifyToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return createErrorResponse(
        new Error('Invalid token'),
        401
      );
    }

    // Get user data
    const userId = decoded.sub;
    console.log('Getting user data for:', userId);

    // Check cache first
    let user = await getCachedUser(userId);
    
    if (!user) {
      // Start transaction for user operations
      session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Get Clerk user data
        const [clerkUser, existingUser] = await Promise.all([
          clerkClient.users.getUser(userId),
          User.findOne({ clerkId: userId }).session(session)
        ]);

        const primaryEmail = clerkUser.emailAddresses.find(email => 
          email.id === clerkUser.primaryEmailAddressId
        )?.emailAddress;

        if (!primaryEmail) {
          throw new Error('No primary email found');
        }

        // Update or create user
        user = await User.findOneAndUpdate(
          { clerkId: userId },
          {
            $set: {
              email: primaryEmail,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              lastLoginAt: new Date()
            },
            $setOnInsert: { 
              createdAt: new Date() 
            }
          },
          { 
            upsert: true, 
            new: true,
            session,
            runValidators: true
          }
        );

        await session.commitTransaction();

        // Cache the result
        USER_CACHE.set(`user-${userId}`, {
          user,
          timestamp: Date.now()
        });

      } catch (error) {
        if (session) {
          await session.abortTransaction();
        }
        throw error;
      }
    }

    // Calculate response time
    const duration = Date.now() - startTime;
    console.log('Sync completed:', {
      userId: user._id,
      duration: `${duration}ms`
    });

    return createResponse({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt
      },
      metrics: {
        duration,
        cached: !!await getCachedUser(userId)
      }
    });

  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    return createErrorResponse(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
    responseLimit: false
  }
};