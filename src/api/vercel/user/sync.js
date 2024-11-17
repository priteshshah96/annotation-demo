import { validateAuth, createAuthResponse } from '../middleware/auth';
import { connectDB } from '../../../lib/db';
import { User } from '../../../models/User';

export const config = {
  runtime: 'nodejs',
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

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[User Sync] Starting sync operation`, { requestId });

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      throw new SyncError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }

    // Validate authentication
    const auth = await validateAuth(req);
    console.log(`[User Sync] Authentication validated`, { 
      requestId, 
      userId: auth.user._id 
    });

    // Get request body
    const userData = req.body;
    validateUserData(userData);

    // Connect to database
    await connectDB();

    // Update user data
    const user = await User.findOneAndUpdate(
      { clerkId: auth.user.clerkId },
      { 
        $set: {
          email: userData.email,
          lastSync: new Date(),
          lastActive: new Date()
        }
      },
      { new: true }
    );

    if (!user) {
      throw new SyncError('User not found', 404, 'USER_NOT_FOUND');
    }

    console.log(`[User Sync] User data updated`, { 
      requestId, 
      userId: user._id 
    });

    const duration = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        lastSync: user.lastSync
      },
      duration: `${duration}ms`
    });

  } catch (error) {
    console.error(`[User Sync] Error:`, { 
      requestId,
      error: error.message,
      code: error.code
    });

    if (error instanceof SyncError) {
      const response = createAuthResponse(error);
      return res.status(error.status).json(response);
    }

    const defaultError = new SyncError(
      'Sync operation failed',
      500,
      'SYNC_FAILED'
    );
    const response = createAuthResponse(defaultError);
    return res.status(defaultError.status).json(response);
  }
}