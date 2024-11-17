import { validateAuth, createAuthResponse } from '../middleware/auth';
import { connectDB } from '../../../lib/db';
import { User } from '../../../models/User';

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

class SyncError extends Error {
  constructor(message, status = 500, code = 'SYNC_ERROR') {
    super(message);
    this.name = 'SyncError';
    this.status = status;
    this.code = code;
  }
}

const validateUserData = (userData) => {
  const requiredFields = ['email', 'clerkId'];
  const missingFields = requiredFields.filter(field => !userData[field]);
  
  if (missingFields.length > 0) {
    throw new SyncError(
      `Missing required fields: ${missingFields.join(', ')}`,
      400,
      'INVALID_USER_DATA'
    );
  }

  if (!userData.email.includes('@')) {
    throw new SyncError(
      'Invalid email format',
      400,
      'INVALID_EMAIL'
    );
  }
};

export default async function handler(req) {
  const startTime = Date.now();
  const requestId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[User Sync] Starting sync operation`, { requestId });

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      throw new SyncError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }

    // Validate auth and get user data
    const auth = await validateAuth(req);
    console.log(`[User Sync] Auth validated`, { 
      requestId, 
      userId: auth.userId 
    });

    // Connect to database if not already connected
    await connectDB();
    console.log(`[User Sync] Database connected`, { requestId });

    // Find user by clerk ID
    const user = await User.findOne({ clerkId: auth.session.sub }).exec();
    
    if (!user) {
      throw new SyncError('User not found', 404, 'USER_NOT_FOUND');
    }

    console.log(`[User Sync] User found`, { 
      requestId, 
      userId: user._id 
    });

    // Update last sync time
    user.lastSyncAt = new Date();
    await user.save();

    const duration = Date.now() - startTime;
    console.log(`[User Sync] Sync completed`, { 
      requestId, 
      duration: `${duration}ms`,
      userId: user._id 
    });

    // Return user data
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          clerkId: user.clerkId,
          createdAt: user.createdAt,
          lastSyncAt: user.lastSyncAt
        },
        requestId,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Request-ID': requestId
        }
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[User Sync] Error during sync`, {
      requestId,
      error: error.message,
      code: error.code,
      duration: `${duration}ms`
    });

    if (error.name === 'AuthError') {
      return createAuthResponse(error);
    }

    const status = error.status || 500;
    const code = error.code || 'SYNC_ERROR';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Sync failed',
        message: error.message,
        code,
        requestId,
        timestamp: new Date().toISOString()
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Request-ID': requestId
        }
      }
    );
  }
}