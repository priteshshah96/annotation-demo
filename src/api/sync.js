// 4. Create api/sync.js for user sync
import { connectDB } from '../../lib/db.js';
import { validateAuth } from '../middleware/auth.js';
import { User } from '../../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    const auth = await validateAuth(req);
    
    if (!auth?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findOneAndUpdate(
      { clerkId: auth.user.clerkId },
      {
        $set: {
          email: auth.user.email,
          firstName: auth.user.firstName,
          lastName: auth.user.lastName,
          lastLoginAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({
      error: 'Sync failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
