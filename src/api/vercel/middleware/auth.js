// src/api/vercel/middleware/auth.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db';
import { User } from '../../../models/User';

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

const log = (message) => {
  console.log(`[Auth] ${message}`);
};

async function validateToken(token) {
  try {
    const session = await clerkClient.sessions.verifySession(token);
    return session.userId;
  } catch (error) {
    log(`Invalid token: ${error.message}`);
    throw new AuthError('Invalid authentication token');
  }
}

async function getOrCreateUser(clerkId) {
  try {
    await connectDB();
    let user = await User.findOne({ clerkId });
    
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      user = await User.create({
        clerkId,
        email: clerkUser.emailAddresses[0].emailAddress,
        name: `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
      });
      log(`Created new user: ${user.email}`);
    }
    
    return user;
  } catch (error) {
    log(`Error getting/creating user: ${error.message}`);
    throw new AuthError('Error processing user data');
  }
}

export async function validateAuth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new AuthError('No authentication token provided');
  }

  const clerkId = await validateToken(token);
  const user = await getOrCreateUser(clerkId);
  
  return { user, clerkId };
}

export function createAuthResponse(error) {
  return {
    status: error.status || 500,
    body: { error: error.message }
  };
}