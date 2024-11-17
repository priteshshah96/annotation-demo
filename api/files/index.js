// src/api/vercel/files/index.js
import { connectDB } from '../lib/db';
import { validateAuth } from '../lib/auth';
import { File } from '../../../models/File.js';
import { Annotation } from '../../../models/Annotation.js';
import mongoose from 'mongoose';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    },
    responseLimit: false
  }
};

// Enhanced CORS headers for Vercel
const setCorsHeaders = (res) => {
  const allowedOrigins = [
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'http://localhost:5173',
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  ].filter(Boolean);

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

// Error response helper
const createErrorResponse = (error, status = 500) => {
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code
  });

  const traceId = `files-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'API_ERROR',
    traceId,
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
};

export default async function handler(req, res) {
  const startTime = Date.now();
  console.log('Files API request:', {
    method: req.method,
    url: req.url,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? '[REDACTED]' : undefined
    }
  });

  // Set CORS headers
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json(createErrorResponse(new Error('Method not allowed'), 405));
    return;
  }

  try {
    console.log('Connecting to database...');
    await connectDB();
    
    console.log('Validating authentication...');
    const auth = await validateAuth(req);
    if (!auth?.user) {
      res.status(401).json(createErrorResponse(new Error('Unauthorized'), 401));
      return;
    }

    const mongoUserId = auth.user._id;
    console.log('Fetching files for user:', mongoUserId);
    
    // Fetch files with aggregation for better performance
    const files = await File.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(mongoUserId) } },
      { $sort: { uploadDate: -1 } },
      {
        $lookup: {
          from: 'annotations',
          let: { fileId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$fileId', '$$fileId'] },
                    { $eq: ['$userId', new mongoose.Types.ObjectId(mongoUserId)] }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'annotationStats'
        }
      },
      {
        $addFields: {
          annotationCount: {
            $ifNull: [{ $arrayElemAt: ['$annotationStats.count', 0] }, 0]
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          totalSteps: 1,
          uploadDate: 1,
          metadata: 1,
          progress: {
            $multiply: [
              { $divide: ['$annotationCount', { $max: ['$totalSteps', 1] }] },
              100
            ]
          }
        }
      }
    ]).exec();

    console.log('Files fetched successfully:', {
      count: files.length,
      duration: `${Date.now() - startTime}ms`
    });

    // Round progress to one decimal place
    const formattedFiles = files.map(file => ({
      ...file,
      progress: Math.round(Math.min(file.progress, 100) * 10) / 10
    }));

    res.json({
      success: true,
      files: formattedFiles,
      count: files.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Files API error:', {
      error: error.message,
      stack: error.stack,
      duration: `${Date.now() - startTime}ms`
    });

    const status = error.status || 500;
    res.status(status).json(createErrorResponse(error, status));
  }
}

// Helper function to calculate accurate progress
async function calculateProgress(fileId, userId) {
  const [annotations, file] = await Promise.all([
    Annotation.countDocuments({ fileId, userId }),
    File.findById(fileId)
  ]);

  if (!file) return 0;
  return Math.min((annotations * 100) / file.totalSteps, 100);
}

// Optional: Add a health check endpoint
export const config2 = {
  api: {
    bodyParser: false
  }
};

export async function HEAD(req, res) {
  try {
    await connectDB();
    res.status(200).end();
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).end();
  }
}