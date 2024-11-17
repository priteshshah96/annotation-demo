// src/api/vercel/user/sync.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Get and validate auth header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = await clerkClient.verifyToken(token);
    if (!decoded?.sub) {
      throw new Error('Invalid token');
    }

    // Get Clerk user
    const clerkUser = await clerkClient.users.getUser(decoded.sub);
    const primaryEmail = clerkUser.emailAddresses.find(
      email => email.id === clerkUser.primaryEmailAddressId
    );

    if (!primaryEmail?.emailAddress) {
      throw new Error('No primary email found');
    }

    // Connect to DB
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

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error) {
    console.error('User sync error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error.message
    });
  }
}