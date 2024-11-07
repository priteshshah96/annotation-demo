// src/api/annotations/[fileId]/sync.js
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
    const { annotations = [], reset = false } = req.body;
    
    if (reset || annotations.length === 0) {
      await Annotation.deleteMany({
        fileId,
        userId: auth.user._id
      });

      await File.findByIdAndUpdate(fileId, {
        $set: { progress: 0 }
      });

      return res.json({
        success: true,
        progress: 0,
        message: 'Annotations reset successfully'
      });
    }

    // Handle sync
    const operations = annotations.map(ann => ({
      updateOne: {
        filter: {
          fileId,
          userId: auth.user._id,
          abstractIndex: ann.abstractIndex,
          sentenceIndex: ann.sentenceIndex,
          entityIndex: ann.entityIndex
        },
        update: {
          $set: {
            answer: ann.answer,
            timestamp: new Date(ann.timestamp)
          }
        },
        upsert: true
      }
    }));

    await Annotation.bulkWrite(operations);

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
      progress,
      message: 'Annotations synced successfully'
    });

  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({
      error: 'Failed to sync annotations',
      details: error.message
    });
  }
}
