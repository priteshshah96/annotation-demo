// src/api/vercel/middleware/auth.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db';
import { User } from '../../../models/User';

export class AuthError extends Error {
  constructor(message, status = 401, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

const AUTH_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function validateToken(token) {
  try {
    // Check cache first
    const cacheKey = `token-${token}`;
    const cachedData = AUTH_CACHE.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return cachedData.decoded;
    }

    const decoded = await clerkClient.verifyToken(token);
    
    // Cache the result
    AUTH_CACHE.set(cacheKey, {
      decoded,
      timestamp: Date.now()
    });

    return decoded;
  } catch (error) {
    console.error('Token validation error:', {
      error: error.message,
      code: error.code,
      type: error.type
    });
    throw new AuthError('Invalid token', 401, error.code || 'INVALID_TOKEN');
  }
}

async function getOrCreateUser(clerkId) {
  try {
    // Check cache first
    const cacheKey = `user-${clerkId}`;
    const cachedUser = AUTH_CACHE.get(cacheKey);
    
    if (cachedUser && Date.now() - cachedUser.timestamp < CACHE_TTL) {
      return cachedUser.user;
    }

    let user = await User.findOne({ clerkId });
    
    if (!user) {
      console.log('Creating new user for clerkId:', clerkId);
      const clerkUser = await clerkClient.users.getUser(clerkId);
      
      const primaryEmail = clerkUser.emailAddresses.find(email => 
        email.id === clerkUser.primaryEmailAddressId
      );

      if (!primaryEmail?.emailAddress) {
        throw new AuthError('No primary email found', 400, 'EMAIL_REQUIRED');
      }

      user = await User.create({
        clerkId,
        email: primaryEmail.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        createdAt: new Date(),
        lastLoginAt: new Date()
      });

      console.log('New user created:', {
        id: user._id,
        email: user.email
      });
    } else {
      // Update last login
      user.lastLoginAt = new Date();
      await user.save();
    }

    // Cache the user
    AUTH_CACHE.set(cacheKey, {
      user,
      timestamp: Date.now()
    });

    return user;
  } catch (error) {
    console.error('User retrieval/creation error:', {
      clerkId,
      error: error.message,
      code: error.code
    });
    throw error;
  }
}

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of AUTH_CACHE.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      AUTH_CACHE.delete(key);
    }
  }
}, CACHE_TTL);

export async function validateAuth(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();

    // Extract token
    const authHeader = req.headers.get('authorization') || 
                      req.headers['authorization'] || 
                      req.headers['Authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid authorization header', 401, 'MISSING_AUTH');
    }

    const token = authHeader.split(' ')[1];
    
    // Validate token
    console.log('Validating auth token...');
    const decoded = await validateToken(token);
    
    if (!decoded?.sub) {
      throw new AuthError('Invalid user ID in token', 401, 'INVALID_USER');
    }

    // Get or create user
    console.log('Getting user data for:', decoded.sub);
    const user = await getOrCreateUser(decoded.sub);

    const duration = Date.now() - startTime;
    console.log('Auth validation completed:', {
      userId: user._id,
      duration: `${duration}ms`
    });

    return {
      session: decoded,
      user,
      userId: user._id
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Auth validation failed:', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`
    });

    // Enhance error details for known cases
    if (error.code === 'resource_not_found') {
      throw new AuthError('User not found in Clerk', 404, 'USER_NOT_FOUND');
    }
    if (error.code === 'token_expired') {
      throw new AuthError('Authentication token expired', 401, 'TOKEN_EXPIRED');
    }
    if (error.code === 'token_invalid') {
      throw new AuthError('Invalid authentication token', 401, 'TOKEN_INVALID');
    }

    throw new AuthError(error.message, error.status || 401, error.code || 'AUTH_FAILED');
  }
}

export function createAuthResponse(error) {
  console.error('Creating auth error response:', {
    message: error.message,
    code: error.code,
    status: error.status
  });

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  // Add trace ID for debugging
  const traceId = `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return new Response(
    JSON.stringify({
      error: 'Authentication failed',
      message: error.message,
      code: error.code,
      traceId,
      timestamp: new Date().toISOString()
    }), 
    { 
      status: error.status || 401,
      headers
    }
  );
}