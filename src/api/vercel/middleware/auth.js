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
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const log = (message, data = {}) => {
  console.log(`[Auth Middleware] ${message}`, {
    timestamp: new Date().toISOString(),
    ...data
  });
};

async function validateToken(token, retryCount = 0) {
  try {
    const cacheKey = `token-${token}`;
    const cachedData = AUTH_CACHE.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      log("Token found in cache", { token: token.substring(0, 8) + '...' });
      return cachedData.decoded;
    }

    const decoded = await clerkClient.verifyToken(token);
    log("Token successfully validated", { sub: decoded.sub });

    AUTH_CACHE.set(cacheKey, {
      decoded,
      timestamp: Date.now()
    });

    return decoded;
  } catch (error) {
    log("Token validation error", { 
      error: error.message, 
      retryCount,
      code: error.code 
    });

    if (retryCount < MAX_RETRIES && 
        (error.code === 'network_error' || error.code === 'service_unavailable')) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      return validateToken(token, retryCount + 1);
    }

    throw new AuthError(
      'Invalid token',
      401,
      error.code || 'INVALID_TOKEN'
    );
  }
}

async function getOrCreateUser(clerkId, retryCount = 0) {
  try {
    await connectDB();
    log("Database connection established", { clerkId });

    let user = await User.findOne({ clerkId });
    log("User database query executed", { clerkId, found: !!user });

    if (!user) {
      log("Creating new user for clerkId", { clerkId });
      const clerkUser = await clerkClient.users.getUser(clerkId);
      
      const primaryEmail = clerkUser.emailAddresses.find(email => 
        email.id === clerkUser.primaryEmailAddressId
      );

      if (!primaryEmail) {
        throw new AuthError(
          'User has no primary email address',
          400,
          'NO_PRIMARY_EMAIL'
        );
      }

      user = new User({
        clerkId,
        email: primaryEmail.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        lastSync: new Date()
      });

      await user.save();
      log("New user created", { userId: user._id });
    }

    return user;
  } catch (error) {
    log("Error in getOrCreateUser", { 
      error: error.message, 
      retryCount,
      code: error.code 
    });

    if (retryCount < MAX_RETRIES && 
        (error.code === 'network_error' || error.code === 'service_unavailable')) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      return getOrCreateUser(clerkId, retryCount + 1);
    }

    throw error;
  }
}

// Clean expired cache entries
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [key, value] of AUTH_CACHE.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      AUTH_CACHE.delete(key);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    log(`Cleaned ${expiredCount} expired cache entries`);
  }
}, CACHE_TTL);

export async function validateAuth(req) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers['authorization'];
    
    if (!authHeader) {
      throw new AuthError(
        'No authorization header',
        401,
        'NO_AUTH_HEADER'
      );
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new AuthError(
        'No token provided',
        401,
        'NO_TOKEN'
      );
    }

    const decoded = await validateToken(token);
    if (!decoded || !decoded.sub) {
      throw new AuthError(
        'Invalid token payload',
        401,
        'INVALID_TOKEN_PAYLOAD'
      );
    }

    const user = await getOrCreateUser(decoded.sub);
    return { user, token: decoded };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    
    throw new AuthError(
      'Authentication failed',
      401,
      'AUTH_FAILED'
    );
  }
}

export function createAuthResponse(error) {
  return {
    success: false,
    error: {
      message: error?.message || 'An unexpected error occurred',
      code: error?.code || 'UNKNOWN_ERROR',
      status: error?.status || 500,
      timestamp: new Date().toISOString()
    }
  };
}