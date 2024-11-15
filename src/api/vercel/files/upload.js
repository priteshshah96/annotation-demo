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

const handleError = (error, req, res) => {
  console.error('File upload error details:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    requestBody: {
      name: req.body?.name,
      contentLength: req.body?.content?.length
    }
  });

  // Handle known error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: Object.values(error.errors).map(err => err.message)
    });
  }

  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return res.status(503).json({
      success: false,
      error: 'Database error',
      details: error.message
    });
  }

  if (error.name === 'AuthError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      details: error.message
    });
  }

  // Default error response
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
  });
};

export default async function handler(req, res) {
  console.log('Starting file upload handler:', {
    method: req.method,
    headers: req.headers,
    bodySize: JSON.stringify(req.body).length
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  try {
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Validate method
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        details: 'Only POST requests are allowed'
      });
    }

    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    console.log('Validating authentication...');
    const auth = await validateAuth(req);
    if (!auth?.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        details: 'User authentication failed'
      });
    }
    console.log('Authentication validated for user:', auth.user._id);

    const { name, content } = req.body;

    // Validate request data
    if (!name || !content) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: 'Name and content are required'
      });
    }

    if (!Array.isArray(content)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format',
        details: 'Content must be an array'
      });
    }

    console.log('Calculating total steps...');
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
    console.log('Total steps calculated:', totalSteps);

    console.log('Creating file document...');
    // Create and save file
    const file = new File({
      userId: auth.user._id,
      name,
      abstracts: content,
      totalSteps,
      progress: 0,
      uploadDate: new Date()
    });

    console.log('Saving file to database...');
    const savedFile = await file.save();
    console.log('File saved successfully:', savedFile._id);

    return res.status(201).json({
      success: true,
      file: {
        _id: savedFile._id,
        name: savedFile.name,
        totalSteps: savedFile.totalSteps,
        progress: savedFile.progress,
        uploadDate: savedFile.uploadDate
      }
    });

  } catch (error) {
    return handleError(error, req, res);
  }
}