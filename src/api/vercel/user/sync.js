import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': process.env.VERCEL_URL || '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json'
};

const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Connect to DB with retry
    await retryOperation(async () => {
      await connectDB();
    });
    
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header'
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token with retry
    const decoded = await retryOperation(async () => {
      return await clerkClient.verifyToken(token);
    });
    
    const userId = decoded.sub;

    // Get Clerk user with retry
    const clerkUser = await retryOperation(async () => {
      const user = await clerkClient.users.getUser(userId);
      if (!user) throw new Error('User not found');
      return user;
    });

    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    );

    // Update MongoDB user with retry
    const user = await retryOperation(async () => {
      return await User.findOneAndUpdate(
        { clerkId: userId },
        {
          $set: {
            email: primaryEmail?.emailAddress,
            username: clerkUser.username,
            lastLoginAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { 
          upsert: true, 
          new: true,
          maxTimeMS: 5000 // 5 second timeout
        }
      );
    });

    if (!user) {
      throw new Error('Failed to create/update user');
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          lastLoginAt: user.lastLoginAt
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Sync error:', {
      message: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Sync failed',
        message: error.message || 'Internal server error'
      }),
      { status: error.status || 500, headers: corsHeaders }
    );
  }
}