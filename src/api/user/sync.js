// src/api/sync.js
import { connectDB } from '../../lib/db.js';
import { validateAuth } from '../middleware/auth.js';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from '../../models/User.js';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  'Content-Type': 'application/json'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await connectDB();
    const auth = await validateAuth(req);
    
    if (!auth?.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    if (req.method === 'GET') {
      return handleGet(auth.userId);
    } else if (req.method === 'POST') {
      return handlePost(auth.userId);
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Sync failed', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handlePost(userId) {
  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;
  
  let user = await User.findOneAndUpdate(
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
    { upsert: true, new: true }
  );

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt
      }
    }),
    { status: 200, headers: corsHeaders }
  );
}

async function handleGet(userId) {
  const user = await User.findOne({ clerkId: userId });
  if (!user) {
    return new Response(
      JSON.stringify({ success: false, error: 'User not found' }),
      { status: 404, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt
      }
    }),
    { status: 200, headers: corsHeaders }
  );
}