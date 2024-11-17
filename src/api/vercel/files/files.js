import { connectDB } from '../../../lib/db';
import { File } from '../../../models/File';
import { Annotation } from '../../../models/Annotation';
import { validateAuth, createAuthResponse } from '../middleware/auth';

export const config = {
  runtime: 'nodejs',
  regions: ['iad1'],
};

class FileError extends Error {
  constructor(message, status = 500, code = 'FILE_ERROR') {
    super(message);
    this.name = 'FileError';
    this.status = status;
    this.code = code;
  }
}

// Set CORS headers
const setCorsHeaders = (res) => {
  const allowedOrigins = [
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'http://localhost:5173',
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  ].filter(Boolean);

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

async function handleUpload(req, res, auth) {
  const formData = await req.formData();
  const file = formData.get('file');
  
  if (!file) {
    throw new FileError('No file uploaded', 400, 'NO_FILE');
  }

  const fileData = new File({
    userId: auth.user._id,
    name: file.name,
    type: file.type,
    size: file.size,
    content: await file.arrayBuffer(),
    uploadedAt: new Date()
  });

  await fileData.save();
  
  return res.status(200).json({
    success: true,
    file: {
      id: fileData._id,
      name: fileData.name,
      type: fileData.type,
      size: fileData.size,
      uploadedAt: fileData.uploadedAt
    }
  });
}

async function handleGetFile(fileId, res, auth) {
  const file = await File.findOne({ 
    _id: fileId,
    userId: auth.user._id 
  });

  if (!file) {
    throw new FileError('File not found', 404, 'FILE_NOT_FOUND');
  }

  return res.status(200).json({
    success: true,
    file: {
      id: file._id,
      name: file.name,
      type: file.type,
      size: file.size,
      content: file.content,
      uploadedAt: file.uploadedAt
    }
  });
}

async function handleListFiles(res, auth) {
  const files = await File.find({ userId: auth.user._id })
    .select('-content')
    .sort({ uploadedAt: -1 });

  return res.status(200).json({
    success: true,
    files: files.map(file => ({
      id: file._id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: file.uploadedAt
    }))
  });
}

async function handleDeleteFile(fileId, res, auth) {
  const file = await File.findOneAndDelete({ 
    _id: fileId,
    userId: auth.user._id 
  });

  if (!file) {
    throw new FileError('File not found', 404, 'FILE_NOT_FOUND');
  }

  // Delete associated annotations
  await Annotation.deleteMany({ fileId });

  return res.status(200).json({
    success: true,
    message: 'File deleted successfully'
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Validate authentication for all requests
    const auth = await validateAuth(req);

    // Connect to database
    await connectDB();

    // Extract file ID from URL if present
    const fileId = req.query.fileId;

    // Route to appropriate handler
    switch (req.method) {
      case 'POST':
        return await handleUpload(req, res, auth);
      
      case 'GET':
        if (!fileId) {
          return await handleListFiles(res, auth);
        }
        return await handleGetFile(fileId, res, auth);
      
      case 'DELETE':
        if (!fileId) {
          throw new FileError('File ID is required', 400, 'MISSING_FILE_ID');
        }
        return await handleDeleteFile(fileId, res, auth);
      
      default:
        throw new FileError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }

  } catch (error) {
    console.error('[Files API] Error:', error);
    
    if (error instanceof FileError) {
      const response = createAuthResponse(error);
      return res.status(error.status).json(response);
    }

    const defaultError = new FileError(
      'File operation failed',
      500,
      'FILE_OPERATION_FAILED'
    );
    const response = createAuthResponse(defaultError);
    return res.status(defaultError.status).json(response);
  }
}