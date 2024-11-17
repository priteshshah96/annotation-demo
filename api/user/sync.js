import { validateAuth, createAuthResponse } from '../middleware/auth.js';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

export const config = {
  regions: ['iad1'],
};

class SyncError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await validateAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await connectDB();
    const updatedUser = await User.findOneAndUpdate(
      { clerkId: user.clerkId },
      { lastSync: new Date() },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        lastSync: updatedUser.lastSync
      }
    });
  } catch (error) {
    console.error('[Sync Error]:', error);
    return createAuthResponse(error);
  }
}