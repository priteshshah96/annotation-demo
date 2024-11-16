import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': process.env.VERCEL_URL || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  'Content-Type': 'application/json'
};

const createResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
};

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Get auth header
  const authHeader = req.headers.get?.('authorization') || 
                    req.headers?.['authorization'] || 
                    req.headers?.['Authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    return createResponse({
      success: false,
      error: 'Missing or invalid authorization header'
    }, 401);
  }

  try {
    // Connect to database with increased timeout
    const db = await Promise.race([
      connectDB(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]);

    const token = authHeader.split(' ')[1];
    
    // Verify token
    let decoded;
    try {
      decoded = await clerkClient.verifyToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return createResponse({
        success: false,
        error: 'Invalid token',
        code: error.code || 'INVALID_TOKEN'
      }, 401);
    }

    // Get user data
    const userId = decoded.sub;
    const [clerkUser, existingUser] = await Promise.all([
      clerkClient.users.getUser(userId),
      User.findOne({ clerkId: userId })
    ]);

    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!primaryEmail) {
      return createResponse({
        success: false,
        error: 'No primary email found'
      }, 400);
    }

    // Update or create user
    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        $set: {
          email: primaryEmail,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          lastLoginAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );

    return createResponse({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error) {
    console.error('Sync error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    return createResponse({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, 500);
  }
}

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true
  }
};