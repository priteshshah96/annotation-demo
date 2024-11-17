import { validateAuth, createAuthResponse } from '../../../src/api/vercel/middleware/auth.js';
import { connectDB } from '../../../src/lib/db.js';
import { User } from '../../../src/models/User.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
    const response = createAuthResponse(error);
    return res.status(response.status || 500).json(response.body);
  }
}
