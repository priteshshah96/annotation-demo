import { connectDB } from '../../lib/db.js';
import { File } from '../../models/File.js';
import { Annotation } from '../../models/Annotation.js';
import { validateAuth } from '../middleware/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

// Helper to set CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

export default async function handler(req, res) {
  try {
    // Set CORS headers
    setCorsHeaders(res);

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow GET
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    await connectDB();
    
    const auth = await validateAuth(req);
    if (!auth?.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Invalid authentication or user not found'
      });
    }

    const mongoUserId = auth.user._id;
    console.log('Fetching files for MongoDB userId:', mongoUserId);
    
    const files = await File.find({ userId: mongoUserId });
    console.log('Found files:', files.length);
    
    const filesWithProgress = await Promise.all(files.map(async (file) => {
      const annotations = await Annotation.countDocuments({
        fileId: file._id,
        userId: mongoUserId
      });
      
      const progress = file.totalSteps > 0 
        ? Math.min((annotations * 100) / file.totalSteps, 100)
        : 0;

      return {
        ...file.toObject(),
        progress: Math.round(progress * 10) / 10
      };
    }));

    return res.json({
      success: true,
      files: filesWithProgress
    });

  } catch (error) {
    console.error('Error fetching files:', error);
    return res.status(500).json({
      error: 'Failed to fetch files',
      details: error.message
    });
  }
}