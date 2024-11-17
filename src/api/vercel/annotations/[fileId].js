import { validateAuth, createAuthResponse } from '../middleware/auth';
import { connectDB } from '../../../lib/db';
import { Annotation } from '../../../models/Annotation';
import { File } from '../../../models/File';

export const config = {
  runtime: 'nodejs',
  regions: ['iad1'],
};

class AnnotationError extends Error {
  constructor(message, status = 500, code = 'ANNOTATION_ERROR') {
    super(message);
    this.name = 'AnnotationError';
    this.status = status;
    this.code = code;
  }
}

const validateAnnotationData = (data) => {
  const requiredFields = ['content', 'position'];
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new AnnotationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      400,
      'INVALID_ANNOTATION_DATA'
    );
  }

  if (!data.position.x || !data.position.y) {
    throw new AnnotationError(
      'Invalid position data',
      400,
      'INVALID_POSITION'
    );
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[Annotation API] Starting operation`, { 
    requestId,
    method: req.method
  });

  try {
    // Validate authentication
    const auth = await validateAuth(req);
    console.log(`[Annotation API] Authentication validated`, { 
      requestId, 
      userId: auth.user._id 
    });

    // Connect to database
    await connectDB();

    // Get fileId from URL
    const fileId = req.query.fileId;
    if (!fileId) {
      throw new AnnotationError(
        'File ID is required',
        400,
        'MISSING_FILE_ID'
      );
    }

    // Check if file exists and user has access
    const file = await File.findOne({
      _id: fileId,
      userId: auth.user._id
    });

    if (!file) {
      throw new AnnotationError(
        'File not found or access denied',
        404,
        'FILE_NOT_FOUND'
      );
    }

    switch (req.method) {
      case 'GET': {
        // Get all annotations for the file
        const annotations = await Annotation.find({ fileId });
        
        return res.status(200).json({
          success: true,
          annotations,
          count: annotations.length,
          duration: `${Date.now() - startTime}ms`
        });
      }

      case 'POST': {
        // Create new annotation
        const annotationData = req.body;
        validateAnnotationData(annotationData);

        const annotation = new Annotation({
          fileId,
          userId: auth.user._id,
          content: annotationData.content,
          position: annotationData.position,
          createdAt: new Date()
        });

        await annotation.save();

        return res.status(201).json({
          success: true,
          annotation,
          duration: `${Date.now() - startTime}ms`
        });
      }

      case 'PUT': {
        // Update annotation
        const annotationId = req.query.annotationId;
        if (!annotationId) {
          throw new AnnotationError(
            'Annotation ID is required',
            400,
            'MISSING_ANNOTATION_ID'
          );
        }

        const annotationData = req.body;
        validateAnnotationData(annotationData);

        const annotation = await Annotation.findOneAndUpdate(
          { 
            _id: annotationId,
            fileId,
            userId: auth.user._id
          },
          {
            $set: {
              content: annotationData.content,
              position: annotationData.position,
              updatedAt: new Date()
            }
          },
          { new: true }
        );

        if (!annotation) {
          throw new AnnotationError(
            'Annotation not found or access denied',
            404,
            'ANNOTATION_NOT_FOUND'
          );
        }

        return res.status(200).json({
          success: true,
          annotation,
          duration: `${Date.now() - startTime}ms`
        });
      }

      case 'DELETE': {
        // Delete annotation
        const annotationId = req.query.annotationId;
        if (!annotationId) {
          throw new AnnotationError(
            'Annotation ID is required',
            400,
            'MISSING_ANNOTATION_ID'
          );
        }

        const annotation = await Annotation.findOneAndDelete({
          _id: annotationId,
          fileId,
          userId: auth.user._id
        });

        if (!annotation) {
          throw new AnnotationError(
            'Annotation not found or access denied',
            404,
            'ANNOTATION_NOT_FOUND'
          );
        }

        return res.status(200).json({
          success: true,
          message: 'Annotation deleted successfully',
          duration: `${Date.now() - startTime}ms`
        });
      }

      default:
        throw new AnnotationError(
          'Method not allowed',
          405,
          'METHOD_NOT_ALLOWED'
        );
    }

  } catch (error) {
    console.error(`[Annotation API] Error:`, {
      requestId,
      error: error.message,
      code: error.code
    });

    if (error instanceof AnnotationError) {
      const response = createAuthResponse(error);
      return res.status(error.status).json(response);
    }

    const defaultError = new AnnotationError(
      'Operation failed',
      500,
      'OPERATION_FAILED'
    );
    const response = createAuthResponse(defaultError);
    return res.status(defaultError.status).json(response);
  }
}