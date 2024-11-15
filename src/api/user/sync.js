// src/api/sync.js
import { connectDB } from '../../lib/db.js';
import { validateAuth } from '../middleware/auth.js';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from '../../models/User.js';

export const config = {
  api: {
    bodyParser: true
  }
};

// Helper to set CORS headers consistently
const setCorsHeaders = (res) => {
  // Allow from Vercel URL in production, or localhost in development
  const allowedOrigins = [
    process.env.VERCEL_URL,
    'http://localhost:5173',
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  ].filter(Boolean);

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

// Helper for consistent error responses
const handleError = (res, error, status = 500) => {
  console.error('Sync error:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });

  return res.status(status).json({
    error: 'Sync failed',
    details: error.message,
    code: error.code || 'SYNC_ERROR'
  });
};

export default async function handler(req, res) {
  try {
    // Always set CORS headers
    setCorsHeaders(res);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Ensure database connection
    await connectDB();

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return handleError(res, error);
  }
}

async function handlePost(req, res) {
  try {
    // Validate auth first
    const auth = await validateAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Missing or invalid authorization',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get user details from Clerk
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    if (!clerkUser) {
      throw new Error('User not found in Clerk');
    }

    // Synchronize with MongoDB
    let user = await User.findOne({ clerkId: auth.userId });
    const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;
    
    if (!user) {
      // Create new user
      user = await User.create({
        clerkId: auth.userId,
        email: primaryEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        createdAt: new Date(),
        lastLoginAt: new Date()
      });
    } else {
      // Update existing user
      user.email = primaryEmail;
      user.firstName = clerkUser.firstName;
      user.lastName = clerkUser.lastName;
      user.lastLoginAt = new Date();
      await user.save();
    }

    // Return success response with user data
    return res.json({
      success: true,
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return handleError(res, error);
  }
}

async function handleGet(req, res) {
  try {
    const auth = await validateAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Missing or invalid authorization',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get MongoDB user data
    const user = await User.findOne({ clerkId: auth.userId });
    if (!user) {
      return res.json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Return user data with sync status
    return res.json({
      success: true,
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt
      },
      syncStatus: {
        lastSync: user.lastLoginAt,
        isComplete: true
      }
    });

  } catch (error) {
    return handleError(res, error);
  }
}