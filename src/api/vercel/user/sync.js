import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json'
};

// Unified header access
const getAuthHeader = (req) => {
  // Handle Vercel Edge headers
  if (req.headers instanceof Headers) {
    return req.headers.get('authorization');
  }
  
  // Handle Vercel Node.js headers
  if (req.headers && typeof req.headers === 'object') {
    return req.headers.authorization || req.headers.Authorization;
  }
  
  return null;
};

const createResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    }
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

  try {
    await connectDB();
    
    // Get and validate auth token
    const authHeader = getAuthHeader(req);
    if (!authHeader?.startsWith('Bearer ')) {
      return createResponse({
        success: false,
        error: 'Missing or invalid authorization header'
      }, 401);
    }

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

    // Get Clerk user
    const userId = decoded.sub;
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(userId);
    } catch (error) {
      console.error('Failed to fetch Clerk user:', error);
      return createResponse({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, 404);
    }

    // Find primary email
    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!primaryEmail) {
      return createResponse({
        success: false,
        error: 'No primary email found'
      }, 400);
    }

    // Update or create user in MongoDB
    let user;
    try {
      user = await User.findOneAndUpdate(
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

      // Success response
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
      console.error('MongoDB operation failed:', error);
      return createResponse({
        success: false,
        error: 'Database operation failed',
        code: 'DB_ERROR'
      }, 500);
    }

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

// Export config for Vercel
export const config = {
  api: {
    bodyParser: true
  }
};