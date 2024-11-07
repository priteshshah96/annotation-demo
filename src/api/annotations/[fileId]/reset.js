// src/api/annotations/[fileId]/reset.js
import { connectDB } from '../../../../lib/db.js';
import { File } from '../../../../models/File.js';
import { Annotation } from '../../../../models/Annotation.js';
import { validateAuth } from '../../../middleware/auth.js';

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    await connectDB();
    const auth = await validateAuth(req);
    const { fileId } = req.query;
    
    // Verify file exists and belongs to user
    const file = await File.findOne({
      _id: fileId,
      userId: auth.user._id
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Delete all annotations
    await Annotation.deleteMany({
      fileId,
      userId: auth.user._id
    });

    // Reset file progress
    await File.findByIdAndUpdate(fileId, {
      $set: { progress: 0 }
    });

    return res.json({
      success: true,
      message: 'All annotations reset successfully',
      progress: 0
    });

  } catch (error) {
    console.error('Reset error:', error);
    return res.status(500).json({
      error: 'Failed to reset annotations',
      details: error.message
    });
  }
}