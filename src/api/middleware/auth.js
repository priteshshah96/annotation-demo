// src/middleware/auth.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from '../../models/User.js';

// Server-side error handling
class AuthError extends Error {
  constructor(message, status = 401, code = 'AUTH_ERROR') {
    super(message);
    this.status = status;
    this.name = 'AuthError';
    this.code = code;
  }
}

export async function validateAuth(req) {
  try {
    // Check for auth header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid authorization header', 401, 'MISSING_AUTH');
    }

    // Extract and verify token
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = await clerkClient.verifyToken(token);
    } catch (error) {
      console.error('Token verification failed:', {
        error: error.message,
        code: error.code,
        status: error.status
      });
      throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
    }

    // Get user ID from verified token
    const userId = decoded.sub;
    if (!userId) {
      throw new AuthError('Invalid user ID in token', 401, 'INVALID_USER');
    }

    // Get or create user in MongoDB
    try {
      let user = await User.findOne({ clerkId: userId });
      
      if (!user) {
        // Fetch user details from Clerk
        const clerkUser = await clerkClient.users.getUser(userId);
        if (!clerkUser) {
          throw new AuthError('User not found in Clerk', 404, 'USER_NOT_FOUND');
        }
        
        // Create new user in MongoDB
        user = await User.create({
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
      } else {
        // Update last login time
        user.lastLoginAt = new Date();
        await user.save();
      }

      // Return auth context
      return {
        session: decoded,
        user,
        userId: user._id,
        auth: {
          userId: user.clerkId,
          isAdmin: user.isAdmin || false,
          token
        }
      };
    } catch (error) {
      console.error('User sync error:', error);
      throw new AuthError('Failed to sync user data', 500, 'SYNC_ERROR');
    }
  } catch (error) {
    console.error('Auth validation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(`Authentication failed: ${error.message}`, 500, 'AUTH_FAILED');
  }
}

// Helper to generate auth response
export function createAuthResponse(error, status = 401) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, private, must-revalidate',
    'Pragma': 'no-cache'
  };

  return new Response(
    JSON.stringify({
      error: 'Authentication failed',
      details: error.message || 'Invalid authentication',
      code: error.code || 'AUTH_ERROR'
    }), 
    { 
      status,
      headers
    }
  );
}

// Middleware for protected routes
export async function requireAuth(req, res, next) {
  try {
    const auth = await validateAuth(req);
    req.auth = auth;
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return createAuthResponse(error, error.status || 401);
  }
}

// Middleware for admin-only routes
export async function requireAdmin(req, res, next) {
  try {
    const auth = await validateAuth(req);
    if (!auth.auth.isAdmin) {
      throw new AuthError('Admin access required', 403, 'ADMIN_REQUIRED');
    }
    req.auth = auth;
    return next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return createAuthResponse(error, error.status || 403);
  }
}

export default {
  validateAuth,
  requireAuth,
  requireAdmin,
  createAuthResponse
};