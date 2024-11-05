import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from '../../models/User.js';

export async function POST(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        details: 'Missing authorization header'
      }), { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await clerkClient.verifyToken(token);
    const userId = decoded.sub;

    // Get user details from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    
    // Find or create user in MongoDB
    let user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      user = await User.create({
        clerkId: userId,
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

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('User sync error:', error);
    return new Response(JSON.stringify({
      error: 'Sync failed',
      details: error.message
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Simple GET endpoint to check user data
export async function GET(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        details: 'Missing authorization header'
      }), { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await clerkClient.verifyToken(token);
    const userId = decoded.sub;

    const user = await User.findOne({ clerkId: userId });
    
    return new Response(JSON.stringify({
      success: true,
      user: user ? {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      } : null
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch user',
      details: error.message
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}