// 2. Create api/annotations/[fileId].js
import { connectDB } from '../../../lib/db.js';
import { Annotation } from '../../../models/Annotation.js';
import { validateAuth } from '../../middleware/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    await connectDB();
    const auth = await validateAuth(req);
    
    if (!auth?.user) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    switch (req.method) {
      case 'GET':
        return await getAnnotations(req, res, auth.user._id);
      case 'POST':
        return await saveAnnotation(req, res, auth.user._id);
      case 'DELETE':
        return await deleteAnnotations(req, res, auth.user._id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
