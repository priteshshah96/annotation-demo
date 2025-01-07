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
    const allowedOrigins = [
      'http://localhost:3000', // Local development
      'https://your-render-app-url.onrender.com' // Production
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', true);
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

    // Calculate total abstracts and events
    const totalAbstracts = file.abstracts.length;
    const totalEvents = file.abstracts.reduce((sum, abstract) => sum + abstract.events.length, 0);

    // Calculate annotated events using annotations
    const annotatedEvents = await Annotation.countDocuments({
      fileId: file._id,
      userId
    });

    // Calculate progress
    const progress = totalEvents > 0 ? Math.round((annotatedEvents / totalEvents) * 100) : 0;

    return res.json({
      success: true,
      file: {
        _id: file._id,
        name: file.name,
        abstracts: file.abstracts,
        totalAbstracts,
        totalEvents,
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
    const totalAbstracts = file.abstracts.length;
    const totalEvents = file.abstracts.reduce((sum, abstract) => sum + abstract.events.length, 0);
    const annotatedEvents = await Annotation.countDocuments({
      fileId: file._id,
      userId
    });

    const progress = totalEvents > 0 ? Math.round((annotatedEvents / totalEvents) * 100) : 0;

    return {
      _id: file._id,
      name: file.name,
      totalAbstracts,
      totalEvents,
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

  // Calculate total abstracts and events
  const totalAbstracts = content.length;
  const totalEvents = content.reduce((sum, abstract) => sum + (abstract.events?.length || 0), 0);

  // Calculate totalSteps
  const totalSteps = content.reduce((steps, abstract) => {
    return steps + abstract.events.reduce((eventSteps, event) => {
      // Count non-empty event types
      const eventTypes = ['Background/Introduction', 'Methods/Approach', 'Results/Findings', 'Conclusions/Implications'];
      eventTypes.forEach(type => {
        if (event[type]) eventSteps++;
      });

      // Count Main Action
      if (event['Main Action']) eventSteps++;

      // Count Arguments fields
      const args = event.Arguments;
      if (args.Agent) eventSteps++;
      if (args.Context) eventSteps++;
      if (args.Purpose) eventSteps++;
      if (args.Method) eventSteps++;
      if (args.Results) eventSteps++;
      if (args.Analysis) eventSteps++;
      if (args.Challenge) eventSteps++;
      if (args.Ethical) eventSteps++;
      if (args.Implications) eventSteps++;
      if (args.Contradictions) eventSteps++;

      // Count Object fields
      if (args.Object['Base Object']) eventSteps++;
      if (args.Object['Base Modifier']) eventSteps++;
      if (args.Object['Attached Object']) eventSteps++;
      if (args.Object['Attached Modifier']) eventSteps++;

      return eventSteps;
    }, 0);
  }, 0);

  const newFile = new File({
    userId,
    name,
    abstracts: content,
    totalAbstracts,
    totalEvents,
    totalSteps, // Add totalSteps here
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
      totalAbstracts: savedFile.totalAbstracts,
      totalEvents: savedFile.totalEvents,
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

  // Delete both file and its annotations
  await Promise.all([
    File.deleteOne({ _id: fileId }),
    Annotation.deleteMany({ fileId })
  ]);

  return res.json({
    success: true,
    message: 'File and related annotations deleted successfully'
  });
}