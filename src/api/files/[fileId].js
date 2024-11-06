import { connectDB } from '../../../lib/db.js';
import { File } from '../../../models/File.js';
import { Annotation } from '../../../models/Annotation.js';
import { validateAuth } from '../../middleware/auth.js';

// Configure request size limits for Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb' // Vercel's limit is 4.5MB, setting slightly lower for safety
    },
    responseLimit: false
  }
};

// Helper to handle errors consistently
const handleError = (error, res) => {
  console.error('API error:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });

  // Return structured error response
  return res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

// Helper to set CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

export default async function handler(req, res) {
  try {
    // Set CORS headers
    setCorsHeaders(res);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Connect to database first
    await connectDB();

    // Validate authentication
    const auth = await validateAuth(req);
    if (!auth?.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Invalid authentication or user not found'
      });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, auth.user._id);
      case 'DELETE':
        return await handleDelete(req, res, auth.user._id);
      case 'POST':
        return await handlePost(req, res, auth.user._id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return handleError(error, res);
  }
}

async function handleGet(req, res, userId) {
  const { fileId } = req.query;

  // Get single file
  if (fileId && fileId !== 'files') {
    const file = await File.findOne({ 
      _id: fileId, 
      userId 
    }).lean();

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const annotations = await Annotation.find({
      fileId: file._id,
      userId
    }).lean();

    const annotationsMap = annotations.reduce((acc, annotation) => {
      const key = `${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`;
      acc[key] = annotation.answer;
      return acc;
    }, {});

    const progress = Math.min((annotations.length * 100) / file.totalSteps, 100);

    return res.json({
      success: true,
      file: {
        _id: file._id,
        name: file.name,
        abstracts: file.abstracts,
        totalSteps: file.totalSteps,
        progress: Math.round(progress * 10) / 10,
        uploadDate: file.uploadDate,
        metadata: file.metadata || {},
        annotations: annotationsMap
      }
    });
  }

  // Get all files
  const files = await File.find({ userId })
    .sort({ uploadDate: -1 })
    .lean();

  const filesWithProgress = await Promise.all(files.map(async (file) => {
    const annotationCount = await Annotation.countDocuments({
      fileId: file._id,
      userId
    });
    
    const progress = Math.min((annotationCount * 100) / file.totalSteps, 100);
    
    return {
      _id: file._id,
      name: file.name,
      totalSteps: file.totalSteps,
      progress: Math.round(progress * 10) / 10,
      uploadDate: file.uploadDate,
      metadata: file.metadata || {}
    };
  }));

  return res.json({
    success: true,
    files: filesWithProgress
  });
}

async function handleDelete(req, res, userId) {
  const { fileId } = req.query;

  const file = await File.findOne({
    _id: fileId,
    userId
  });

  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }

  // Use transaction for atomic operation
  const session = await File.startSession();
  try {
    await session.withTransaction(async () => {
      await File.deleteOne({ _id: fileId }).session(session);
      await Annotation.deleteMany({ fileId }).session(session);
    });

    return res.json({
      success: true,
      message: 'File and related annotations deleted successfully'
    });
  } finally {
    await session.endSession();
  }
}

async function handlePost(req, res, userId) {
  const { name, content, metadata } = req.body;

  if (!name || !content) {
    return res.status(400).json({
      success: false,
      error: 'Name and content are required'
    });
  }

  if (!Array.isArray(content)) {
    return res.status(400).json({
      success: false,
      error: 'Content must be an array of abstracts'
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

  const newFile = new File({
    userId,
    name,
    abstracts: content,
    totalSteps,
    progress: 0,
    uploadDate: new Date(),
    metadata: metadata || {}
  });

  const savedFile = await newFile.save();

  return res.status(201).json({
    success: true,
    file: {
      _id: savedFile._id,
      name: savedFile.name,
      totalSteps: savedFile.totalSteps,
      progress: savedFile.progress,
      uploadDate: savedFile.uploadDate,
      metadata: savedFile.metadata
    }
  });
}