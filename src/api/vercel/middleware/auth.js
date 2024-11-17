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

const log = (message, data = {}) => {
  console.log(`[Auth Middleware] ${message}`, data);
};

async function validateToken(token) {
  try {
    const cacheKey = `token-${token}`;
    const cachedData = AUTH_CACHE.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      log("Token found in cache", { token });
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
    log("Token validation error", { error: error.message });
    throw new AuthError('Invalid token', 401, error.code || 'INVALID_TOKEN');
  }
}

async function getOrCreateUser(clerkId) {
  try {
    const cacheKey = `user-${clerkId}`;
    const cachedUser = AUTH_CACHE.get(cacheKey);
    
    if (cachedUser && Date.now() - cachedUser.timestamp < CACHE_TTL) {
      log("User found in cache", { clerkId });
      return cachedUser.user;
    }

    let user = await User.findOne({ clerkId });
    log("User database query executed", { clerkId, found: !!user });

    if (!user) {
      log("Creating new user for clerkId", { clerkId });
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
      log("New user created", { userId: user._id });
    } else {
      user.lastLoginAt = new Date();
      await user.save();
      log("User last login updated", { userId: user._id });
    }

    AUTH_CACHE.set(cacheKey, {
      user,
      timestamp: Date.now()
    });

    return user;
  } catch (error) {
    log("Error during user retrieval/creation", { error: error.message, clerkId });
    throw error;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of AUTH_CACHE.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      AUTH_CACHE.delete(key);
    }
  }
  log("Expired cache entries cleaned");
}, CACHE_TTL);

export async function validateAuth(req) {
  const startTime = Date.now();
  
  try {
    await connectDB();
    log("Database connection established");

    const authHeader = req.headers.get('authorization') || 
                      req.headers['authorization'] || 
                      req.headers['Authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      log("Missing or invalid authorization header");
      throw new AuthError('Missing or invalid authorization header', 401, 'MISSING_AUTH');
    }

    const token = authHeader.split(' ')[1];
    log("Authorization token extracted");

    const decoded = await validateToken(token);
    log("Token validated successfully", { sub: decoded.sub });

    const user = await getOrCreateUser(decoded.sub);
    log("User retrieved or created", { userId: user._id });

    const duration = Date.now() - startTime;
    log("Auth validation completed", { duration: `${duration}ms`, userId: user._id });

    return {
      session: decoded,
      user,
      userId: user._id
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    log("Auth validation failed", { error: error.message, duration: `${duration}ms` });

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
  log("Creating auth error response", { error: error.message });

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

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