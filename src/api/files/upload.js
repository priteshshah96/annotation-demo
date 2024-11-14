// src/api/files/upload.js
import { connectDB } from '../../lib/db.js';
import { File } from '../../models/File.js';
import { validateAuth } from '../middleware/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

// Helper to set CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

export default async function handler(req, res) {
  try {
    setCorsHeaders(res);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        details: 'Only POST requests are allowed for file uploads'
      });
    }

    // Connect to database
    await connectDB();

    // Validate authentication
    const auth = await validateAuth(req);
    if (!auth?.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        details: 'Invalid authentication or user not found'
      });
    }

    const { name, content } = req.body;

    // Validate request data
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

    // Calculate total steps
    const totalSteps = content.reduce((total, abstract) => {
      if (!abstract.sentences || !Array.isArray(abstract.sentences)) {
        return total;
      }
      return total + abstract.sentences.reduce((sentTotal, sentence) => {
        const entityCount = sentence.scientific_entities?.length || 0;
        return sentTotal + entityCount + 1;
      }, 0);
    }, 0);

    // Create new file document
    const newFile = new File({
      userId: auth.user._id,
      name,
      abstracts: content,
      totalSteps,
      progress: 0,
      uploadDate: new Date()
    });

    // Save file to database
    const savedFile = await newFile.save();

    // Return success response
    return res.status(201).json({
      success: true,
      file: {
        _id: savedFile._id,
        name: savedFile.name,
        totalSteps: savedFile.totalSteps,
        progress: savedFile.progress,
        uploadDate: savedFile.uploadDate,
        metadata: savedFile.metadata
      },
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('File upload error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    // Handle other errors
    return res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
}