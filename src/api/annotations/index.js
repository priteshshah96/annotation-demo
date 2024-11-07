// src/api/annotations/index.js
import { connectDB } from '../../../lib/db.js';
import { File } from '../../../models/File.js';
import { Annotation } from '../../src/models/Annotation.js';
import { validateAuth } from '../src/middleware/auth.js';

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
    
    const { fileId, abstractIndex, sentenceIndex, entityIndex, answer } = req.body;

    // Save annotation
    const annotation = await Annotation.findOneAndUpdate(
      {
        fileId,
        userId: auth.user._id,
        abstractIndex,
        sentenceIndex,
        entityIndex
      },
      {
        $set: {
          answer,
          timestamp: new Date()
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    // Update progress
    const totalAnnotations = await Annotation.countDocuments({
      fileId,
      userId: auth.user._id
    });

    const file = await File.findById(fileId);
    const progress = Math.min((totalAnnotations * 100) / file.totalSteps, 100);

    await File.findByIdAndUpdate(fileId, {
      $set: { progress: Math.round(progress * 10) / 10 }
    });

    return res.json({
      success: true,
      annotation,
      progress
    });

  } catch (error) {
    console.error('Annotation error:', error);
    return res.status(500).json({
      error: 'Failed to save annotation',
      details: error.message
    });
  }
}
