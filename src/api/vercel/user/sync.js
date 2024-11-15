import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

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
    // Connect to DB with timeout
    const connectPromise = connectDB();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
    
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error: 'Auth failed',
          message: 'Missing or invalid authorization header'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = await clerkClient.verifyToken(token);
    const userId = decoded.sub;

    // Get user with timeout
    const userPromise = clerkClient.users.getUser(userId);
    const userTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Clerk API timeout')), 5000)
    );
    const clerkUser = await Promise.race([userPromise, userTimeout]);

    if (!clerkUser) {
      return new Response(
        JSON.stringify({
          error: 'User not found',
          message: 'User not found in Clerk'
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const primaryEmail = clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId);

    // DB update with timeout
    const updatePromise = User.findOneAndUpdate(
      { clerkId: userId },
      {
        $set: {
          email: primaryEmail?.emailAddress,
          username: clerkUser.username,
          lastLoginAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true, new: true }
    );

    const updateTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database update timeout')), 5000)
    );

    const user = await Promise.race([updatePromise, updateTimeout]);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          lastLoginAt: user.lastLoginAt
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Sync error:', error);
    
    // Ensure we always return valid JSON
    return new Response(
      JSON.stringify({
        error: 'Sync failed',
        message: error.message || 'An unknown error occurred'
      }),
      { 
        status: error.status || 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}