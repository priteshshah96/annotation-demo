import { connectDB } from '../../../lib/db.js';
import { File } from '../../../models/File.js';
import { Annotation } from '../../../models/Annotation.js';
import { validateAuth } from '../../middleware/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};

export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Validate authentication
    const auth = await validateAuth(req);
    if (!auth?.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Invalid authentication or user not found'
      });
    }

    // Connect to database
    await connectDB();

    // Route based on HTTP method
    switch (req.method) {
      case 'GET':
        return handleGet(req, res, auth.user._id);
      case 'DELETE':
        return handleDelete(req, res, auth.user._id);
      case 'POST':
        return handlePost(req, res, auth.user._id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function handleGet(req, res, userId) {
  const { fileId } = req.query;

  // Get single file
  if (fileId && fileId !== 'files') {
    const file = await File.findOne({ 
      _id: fileId, 
      userId 
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        details: 'File does not exist or you do not have permission to access it'
      });
    }

    const annotations = await Annotation.find({
      fileId: file._id,
      userId
    }).lean();

    const annotationsMap = annotations.reduce((acc, annotation) => {
      const key = `${annotation.abstractIndex}-${annotation.eventIndex}-${annotation.fieldPath}`;
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
        progress,
        uploadDate: file.uploadDate,
        metadata: file.metadata || {},
        annotations: annotationsMap
      }
    });
  }

  // Get all files
  const files = await File.find({ userId })
    .sort({ uploadDate: -1 });

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
      progress,
      uploadDate: file.uploadDate,
      metadata: file.metadata || {}
    };
  }));

  return res.json({
    success: true,
    files: filesWithProgress
  });
}

async function handlePost(req, res, userId) {
  const { name, content, metadata } = req.body;

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
    if (!abstract.events || !Array.isArray(abstract.events)) {
      return total;
    }
    return total + abstract.events.reduce((eventTotal, event) => {
      let steps = 0;
      // Count non-empty event type fields
      ['Background/Introduction', 'Methods/Approach', 'Results/Findings', 'Conclusions/Implications'].forEach(type => {
        if (event[type]) steps++;
      });
      
      // Count Main Action if present
      if (event['Main Action']) steps++;
      
      // Count argument fields
      if (event.Arguments) {
        if (event.Arguments.Agent) steps++;
        if (event.Arguments.Context) steps++;
        if (event.Arguments.Purpose) steps++;
        if (event.Arguments.Method) steps++;
        if (event.Arguments.Results) steps++;
        if (event.Arguments.Analysis) steps++;
        if (event.Arguments.Challenge) steps++;
        if (event.Arguments.Ethical) steps++;
        if (event.Arguments.Implications) steps++;
        if (event.Arguments.Contradictions) steps++;
        
        // Count Object fields
        const obj = event.Arguments.Object;
        if (obj) {
          if (obj['Base Object']) steps++;
          if (obj['Base Modifier']) steps++;
          if (obj['Attached Object']) steps++;
          if (obj['Attached Modifier']) steps++;
        }
      }
      
      return eventTotal + steps;
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

async function handleDelete(req, res, userId) {
  const { fileId } = req.query;

  const file = await File.findOne({
    _id: fileId,
    userId
  });

  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found',
      details: 'File does not exist or you do not have permission to delete it'
    });
  }

  await Promise.all([
    File.deleteOne({ _id: fileId }),
    Annotation.deleteMany({ fileId })
  ]);

  return res.json({
    success: true,
    message: 'File and related annotations deleted successfully'
  });
}