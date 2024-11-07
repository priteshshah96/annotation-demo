import { connectDB } from '../lib/db.js';
import { File } from '../models/File.js';
import { Annotation } from '../models/Annotation.js';
import { validateAuth } from './middleware/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

// Helper function to set CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

export default async function handler(req, res) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    await connectDB();
    const auth = await validateAuth(req);
    
    if (!auth?.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Invalid authentication or user not found'
      });
    }

    const { fileId } = req.query;
    const path = req.url;

    // Handle file upload
    if (path.includes('/upload') && req.method === 'POST') {
      return handleUpload(req, res, auth.user._id);
    }

    // Handle file operations with fileId
    if (fileId) {
      switch (req.method) {
        case 'GET':
          return handleGetFile(req, res, auth.user._id, fileId);
        case 'DELETE':
          return handleDeleteFile(req, res, auth.user._id, fileId);
        default:
          return res.status(405).json({ error: 'Method not allowed' });
      }
    }

    // Handle list all files (GET without fileId)
    if (req.method === 'GET') {
      return handleListFiles(req, res, auth.user._id);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Files API error:', error);
    return res.status(500).json({
      error: 'Failed to process request',
      details: error.message
    });
  }
}

// Handler for /api/files/upload
async function handleUpload(req, res, userId) {
  const { name, content } = req.body;

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
    userId,
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
}

// Handler for /api/files/:fileId (GET)
async function handleGetFile(req, res, userId, fileId) {
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

// Handler for /api/files/:fileId (DELETE)
async function handleDeleteFile(req, res, userId, fileId) {
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

// Handler for /api/files (GET - list all files)
async function handleListFiles(req, res, userId) {
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