import { validateAuth } from './lib/auth';
import { connectDB } from './lib/db';

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

function handleError(error) {
  console.error('[Annotation Error]:', error);
  return new Response(
    JSON.stringify({ error: 'Internal server error', details: error.message }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

function validateAnnotationData(data) {
  const { content, position } = data;
  if (!content || !position) {
    throw new Error('Missing required fields: content, position');
  }
  return true;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const fileId = url.pathname.split('/').pop();

  if (!fileId) {
    return new Response(
      JSON.stringify({ error: 'File ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const auth = await validateAuth(req);
    if (!auth || !auth.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = await connectDB();

    // First check if the file exists and user has access
    const file = await db.findOne('files', { 
      _id: fileId,
      userId: auth.user.id
    });

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'File not found or access denied' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      const annotations = await db.find('annotations', { 
        fileId,
        userId: auth.user.id
      });

      return new Response(
        JSON.stringify({ annotations }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const data = await req.json();
      validateAnnotationData(data);

      const annotation = {
        ...data,
        fileId,
        userId: auth.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const id = await db.insertOne('annotations', annotation);

      // Update file progress
      const annotations = await db.find('annotations', { 
        fileId,
        userId: auth.user.id
      });

      const progress = Math.min((annotations.length * 100) / file.totalSteps, 100);
      await db.updateOne(
        'files',
        { _id: fileId },
        { $set: { progress: Math.round(progress * 10) / 10 } }
      );

      return new Response(
        JSON.stringify({ 
          id, 
          annotation,
          progress: Math.round(progress * 10) / 10
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT') {
      const data = await req.json();
      const { id, ...updates } = data;
      
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Annotation ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const annotation = await db.findOne('annotations', { 
        _id: id,
        fileId,
        userId: auth.user.id
      });

      if (!annotation) {
        return new Response(
          JSON.stringify({ error: 'Annotation not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await db.updateOne(
        'annotations',
        { _id: id },
        { 
          $set: {
            ...updates,
            updatedAt: new Date().toISOString()
          }
        }
      );

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Annotation ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const annotation = await db.findOne('annotations', { 
        _id: id,
        fileId,
        userId: auth.user.id
      });

      if (!annotation) {
        return new Response(
          JSON.stringify({ error: 'Annotation not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await db.deleteOne('annotations', { _id: id });

      // Update file progress
      const annotations = await db.find('annotations', { 
        fileId,
        userId: auth.user.id
      });

      const progress = Math.min((annotations.length * 100) / file.totalSteps, 100);
      await db.updateOne(
        'files',
        { _id: fileId },
        { $set: { progress: Math.round(progress * 10) / 10 } }
      );

      return new Response(
        JSON.stringify({ 
          success: true,
          progress: Math.round(progress * 10) / 10
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    return handleError(error);
  }
}