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
    const cacheKey = `user-${clerkId}`;
    const cachedUser = AUTH_CACHE.get(cacheKey);
    
    if (cachedUser && Date.now() - cachedUser.timestamp < CACHE_TTL) {
      log("User found in cache", { clerkId });
      return cachedUser.user;
    }

    let user = await User.findOne({ clerkId }).exec();
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

      // Create user with retry on duplicate key error
      try {
        user = await User.create({
          clerkId,
          email: primaryEmail.emailAddress,
          firstName: clerkUser.firstName || null,
          lastName: clerkUser.lastName || null,
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
        log("New user created", { userId: user._id });
      } catch (error) {
        if (error.code === 11000 && retryCount < MAX_RETRIES) {
          // Duplicate key error, retry after delay
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return getOrCreateUser(clerkId, retryCount + 1);
        }
        throw error;
      }
    } else {
      // Update user data if needed
      const needsUpdate = user.lastLoginAt < new Date(Date.now() - 5 * 60 * 1000);
      if (needsUpdate) {
        user.lastLoginAt = new Date();
        await user.save();
        log("User last login updated", { userId: user._id });
      }
    }

    AUTH_CACHE.set(cacheKey, {
      user,
      timestamp: Date.now()
    });

    return user;
  } catch (error) {
    log("Error during user retrieval/creation", { 
      error: error.message, 
      clerkId,
      retryCount 
    });

    if (retryCount < MAX_RETRIES && 
        (error.name === 'MongoNetworkError' || 
         error.name === 'MongoTimeoutError' ||
         error.code === 11000)) {
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
    log("Expired cache entries cleaned", { count: expiredCount });
  }
}, CACHE_TTL);

export async function validateAuth(req) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Establish DB connection first
    await connectDB();
    log("Database connection established", { requestId });

    // Extract and validate auth header
    const authHeader = req.headers.get('authorization') || 
                      req.headers['authorization'] || 
                      req.headers['Authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      log("Missing or invalid authorization header", { requestId });
      throw new AuthError('Missing or invalid authorization header', 401, 'MISSING_AUTH');
    }

    const token = authHeader.split(' ')[1];
    log("Authorization token extracted", { requestId });

    // Validate token and get user in parallel
    const [decoded, connection] = await Promise.all([
      validateToken(token),
      mongoose.connection.readyState !== 1 ? connectDB() : Promise.resolve()
    ]);

    log("Token validated successfully", { requestId, sub: decoded.sub });

    const user = await getOrCreateUser(decoded.sub);
    log("User retrieved or created", { requestId, userId: user._id });

    const duration = Date.now() - startTime;
    log("Auth validation completed", { 
      requestId, 
      duration: `${duration}ms`, 
      userId: user._id 
    });

    return {
      session: decoded,
      user,
      userId: user._id,
      requestId
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    log("Auth validation failed", { 
      requestId,
      error: error.message, 
      code: error.code,
      duration: `${duration}ms` 
    });

    // Map specific error types to appropriate responses
    if (error.code === 'resource_not_found') {
      throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (error.code === 'token_expired') {
      throw new AuthError('Session expired', 401, 'TOKEN_EXPIRED');
    }
    if (error.code === 'token_invalid') {
      throw new AuthError('Invalid session', 401, 'TOKEN_INVALID');
    }
    if (error.name === 'MongoNetworkError') {
      throw new AuthError('Database connection error', 503, 'DB_ERROR');
    }

    throw new AuthError(
      error.message, 
      error.status || 401, 
      error.code || 'AUTH_FAILED'
    );
  }
}

export function createAuthResponse(error) {
  const traceId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  log("Creating auth error response", { 
    traceId,
    error: error.message,
    code: error.code
  });

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Trace-ID': traceId
  };

  return new Response(
    JSON.stringify({
      success: false,
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