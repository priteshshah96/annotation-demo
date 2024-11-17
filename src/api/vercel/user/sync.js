// src/api/vercel/user/sync.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

// Vercel API configuration
export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: true
  }
};

// CORS headers setup for Vercel
const setCorsHeaders = (res) => {
  const allowedOrigins = [
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'http://localhost:5173',
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  ].filter(Boolean);

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

export default async function handler(req, res) {
  // Set CORS headers first
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      details: 'Only POST requests are allowed'
    });
  }

  try {
    // Get and validate authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        details: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Clerk
    const decoded = await clerkClient.verifyToken(token);
    if (!decoded?.sub) {
      throw new Error('Invalid token');
    }

    // Get Clerk user details
    const clerkUser = await clerkClient.users.getUser(decoded.sub);
    const primaryEmail = clerkUser.emailAddresses.find(
      email => email.id === clerkUser.primaryEmailAddressId
    );

    if (!primaryEmail?.emailAddress) {
      throw new Error('No primary email found');
    }

    // Connect to database
    await connectDB();

    // Update or create user
    const user = await User.findOneAndUpdate(
      { clerkId: decoded.sub },
      {
        $set: {
          email: primaryEmail.emailAddress,
          firstName: clerkUser.firstName || null,
          lastName: clerkUser.lastName || null,
          lastLoginAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true 
      }
    ).lean();

    // Return success response
    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('User sync error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });

    // Return error response
    return res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      traceId: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  }
}