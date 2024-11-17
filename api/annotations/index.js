// Edge-compatible annotations handler
const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;
const CLERK_API_URL = 'https://api.clerk.dev/v1';

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

async function validateAuth(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      console.warn('[Auth] No token provided');
      return null;
    }

    const response = await fetch(`${CLERK_API_URL}/jwt/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jwt: token })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    return { user: data.sub };
  } catch (error) {
    console.error('[Auth] Error:', error);
    return null;
  }
}

function handleError(error) {
  console.error('[Annotation Error]:', error);
  return new Response(
    JSON.stringify({ 
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }),
    { 
      status: error.status || 500,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}

function validateAnnotationData(data) {
  const { fileId, content, position } = data;
  if (!fileId || !content || !position) {
    const error = new Error('Missing required fields: fileId, content, position');
    error.status = 400;
    throw error;
  }
}

export default async function handler(req) {
  try {
    const auth = await validateAuth(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const data = await req.json();
      validateAnnotationData(data);

      // Create annotation
      const response = await fetch(`${MONGODB_URI}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: 'annotations',
          action: 'insertOne',
          document: {
            ...data,
            userId: auth.user,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create annotation');
      }

      const result = await response.json();
      return new Response(
        JSON.stringify(result),
        { 
          status: 201,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const fileId = url.searchParams.get('fileId');

      if (!fileId) {
        const error = new Error('fileId is required');
        error.status = 400;
        throw error;
      }

      // Get annotations for file
      const response = await fetch(`${MONGODB_URI}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: 'annotations',
          action: 'find',
          query: { fileId, userId: auth.user },
          options: { sort: { createdAt: -1 } }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch annotations');
      }

      const annotations = await response.json();
      return new Response(
        JSON.stringify(annotations),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return handleError(error);
  }
}