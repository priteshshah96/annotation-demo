// api/files/upload.js
import { connectDB } from '../../lib/db.js';
import { File } from '../../models/File.js';
import { validateAuth } from '../middleware/auth.js';

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
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow POST method
    if (req.method !== 'POST') {
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

    const { name, content } = req.body;
    const mongoUserId = auth.user._id;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: 'Name and content are required'
      });
    }

    if (!Array.isArray(content)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file format',
        details: 'Content must be an array of abstracts'
      });
    }

    const totalSteps = content.reduce((total, abstract) => {
      if (!abstract.sentences || !Array.isArray(abstract.sentences)) {
        return total;
      }
      return total + abstract.sentences.reduce((sentTotal, sentence) => {
        const entityCount = sentence.scientific_entities?.length || 0;
        return sentTotal + entityCount + 1;
      }, 0);
    }, 0);

    const newFile = new File({
      userId: mongoUserId,
      name,
      abstracts: content,
      totalSteps,
      progress: 0,
      uploadDate: new Date()
    });

    const savedFile = await newFile.save();

    return res.status(201).json({
      success: true,
      file: savedFile,
      message: 'File uploaded successfully'
    });
    
  } catch (error) {
    console.error('Upload API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
}