// src/api/vercel/middleware/auth.js
import { Clerk } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db';
import { User } from '../../../models/User';

const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

const log = (message) => {
  console.log(`[Auth] ${message}`);
};

async function getOrCreateUser(clerkId) {
  try {
    await connectDB();
    let user = await User.findOne({ clerkId });
    
    if (!user) {
      const clerkUser = await clerk.users.getUser(clerkId);
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
  try {
    // Get the session token from the Authorization header
    const sessionToken = req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!sessionToken) {
      console.warn('[Auth] No token provided');
      return null;
    }

    // Verify the session using Clerk SDK
    const session = await clerk.sessions.verifySession(sessionToken);
    if (!session) {
      console.warn('[Auth] Invalid session');
      return null;
    }

    // Get the user from Clerk
    const user = await clerk.users.getUser(session.userId);
    if (!user) {
      console.warn('[Auth] User not found');
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName
      },
      session: {
        id: session.id
      }
    };
  } catch (error) {
    console.error('[Auth] Validation error:', error);
    return null;
  }
}

export function createAuthResponse(error) {
  return {
    status: error.status || 500,
    body: { error: error.message }
  };
}