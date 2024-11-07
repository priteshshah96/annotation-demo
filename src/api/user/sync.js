import { connectDB } from '../../lib/db.js';
import { validateAuth } from '../middleware/auth.js';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from '../../models/User.js';

export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

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
    console.error('User sync error:', error);
    return res.status(500).json({
      error: 'Sync failed',
      details: error.message
    });
  }
}

async function handlePost(req, res) {
  const auth = await validateAuth(req);
  if (!auth?.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: 'Missing authorization header'
    });
  }

  // Get user details from Clerk
  const clerkUser = await clerkClient.users.getUser(auth.userId);
    
  // Find or create user in MongoDB
  let user = await User.findOne({ clerkId: auth.userId });
    
  if (!user) {
    user = await User.create({
      clerkId: auth.userId,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      createdAt: new Date(),
      lastLoginAt: new Date()
    });
  } else {
    user.email = clerkUser.emailAddresses[0]?.emailAddress;
    user.firstName = clerkUser.firstName;
    user.lastName = clerkUser.lastName;
    user.lastLoginAt = new Date();
    await user.save();
  }

  return res.json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    }
  });
}

async function handleGet(req, res) {
  const auth = await validateAuth(req);
  if (!auth?.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: 'Missing authorization header'
    });
  }

  const user = await User.findOne({ clerkId: auth.userId });
    
  return res.json({
    success: true,
    user: user ? {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    } : null
  });
}