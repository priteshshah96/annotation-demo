// src/api/vercel/user/sync.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db';
import { User } from '../../../models/User';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await connectDB();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const decoded = await clerkClient.verifyToken(token);
    const userId = decoded.sub;

    const clerkUser = await clerkClient.users.getUser(userId);
    if (!clerkUser) {
      throw new Error('User not found in Clerk');
    }

    let user = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        $set: {
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          lastLoginAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true, new: true }
    );

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          lastLoginAt: user.lastLoginAt
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        error: 'Sync failed',
        message: error.message
      }),
      { status: error.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );
  }
}