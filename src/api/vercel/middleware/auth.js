// src/api/vercel/middleware/auth.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db';
import { User } from '../../../models/User';

export class AuthError extends Error {
  constructor(message, status = 401, code = 'AUTH_ERROR') {
    super(message);
    this.status = status;
    this.name = 'AuthError';
    this.code = code;
  }
}

export async function validateAuth(req) {
  await connectDB();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header', 401, 'MISSING_AUTH');
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = await clerkClient.verifyToken(token);
    const userId = decoded.sub;

    if (!userId) {
      throw new AuthError('Invalid user ID in token', 401, 'INVALID_USER');
    }

    let user = await User.findOne({ clerkId: userId });
    
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      
      user = await User.create({
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        createdAt: new Date(),
        lastLoginAt: new Date()
      });
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    return {
      session: decoded,
      user,
      userId: user._id
    };
  } catch (error) {
    if (error.code === 'resource_not_found') {
      throw new AuthError('User not found in Clerk', 404, 'USER_NOT_FOUND');
    }
    throw new AuthError(error.message, 401, error.code || 'AUTH_FAILED');
  }
}

export function createAuthResponse(error) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  return new Response(
    JSON.stringify({
      error: 'Authentication failed',
      message: error.message,
      code: error.code
    }), 
    { 
      status: error.status || 401,
      headers
    }
  );
}