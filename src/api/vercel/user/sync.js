import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

export default async function handler(request) {
  // Basic CORS headers
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    // Get token
    const authHeader = request.headers.get('authorization') || request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }

    const token = authHeader.split(' ')[1];

    // Quick verification
    const decoded = await clerkClient.verifyToken(token);
    if (!decoded?.sub) {
      throw new Error('Invalid token');
    }

    // Get Clerk user - this is fast
    const clerkUser = await clerkClient.users.getUser(decoded.sub);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      throw new Error('No email found');
    }

    // Connect to DB - this should be quick as we've optimized connection pooling
    await connectDB();

    // Simple upsert - keeping it minimal
    const user = await User.findOneAndUpdate(
      { clerkId: decoded.sub },
      {
        email,
        firstName: clerkUser.firstName || clerkUser.username,
        lastLoginAt: new Date()
      },
      { upsert: true, new: true }
    ).lean(); // Using lean() for faster queries

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName
        }
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers }
    );
  }
}