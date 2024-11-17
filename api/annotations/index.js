import { connectDB } from '../lib/db';
import { validateAuth } from '../lib/auth';

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
  const { fileId, content, position } = data;
  if (!fileId || !content || !position) {
    throw new Error('Missing required fields: fileId, content, position');
  }
  return true;
}

export default async function handler(req) {
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
    
    if (req.method === 'GET') {
      const fileId = new URL(req.url).searchParams.get('fileId');
      if (!fileId) {
        return new Response(
          JSON.stringify({ error: 'fileId is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

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
        userId: auth.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const id = await db.insertOne('annotations', annotation);
      return new Response(
        JSON.stringify({ id, annotation }),
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
      const id = new URL(req.url).searchParams.get('id');
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'Annotation ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const annotation = await db.findOne('annotations', { 
        _id: id,
        userId: auth.user.id
      });

      if (!annotation) {
        return new Response(
          JSON.stringify({ error: 'Annotation not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await db.deleteOne('annotations', { _id: id });
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    return handleError(error);
  }
}