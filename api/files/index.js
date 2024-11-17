// Edge-compatible files index handler
const CLERK_API_URL = 'https://api.clerk.dev/v1';
const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;

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

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

async function calculateProgress(fileId, userId) {
  // Get total annotations
  const annotationsResponse = await fetch(`${MONGODB_URI}/api/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: 'annotations',
      action: 'count',
      query: { fileId, userId }
    })
  });

  if (!annotationsResponse.ok) {
    throw new Error('Failed to count annotations');
  }

  const { count } = await annotationsResponse.json();

  // Get file details
  const fileResponse = await fetch(`${MONGODB_URI}/api/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: 'files',
      action: 'findOne',
      query: { _id: fileId, userId }
    })
  });

  if (!fileResponse.ok) {
    throw new Error('Failed to fetch file');
  }

  const file = await fileResponse.json();
  if (!file) {
    throw new Error('File not found');
  }

  return Math.min((count * 100) / file.totalSteps, 100);
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

    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');

    if (req.method === 'GET') {
      if (!fileId) {
        // List all files
        const response = await fetch(`${MONGODB_URI}/api/data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            collection: 'files',
            action: 'find',
            query: { userId: auth.user }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const files = await response.json();
        return new Response(
          JSON.stringify(files),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        // Get specific file with progress
        const fileResponse = await fetch(`${MONGODB_URI}/api/data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            collection: 'files',
            action: 'findOne',
            query: { _id: fileId, userId: auth.user }
          })
        });

        if (!fileResponse.ok) {
          throw new Error('Failed to fetch file');
        }

        const file = await fileResponse.json();
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'File not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const progress = await calculateProgress(fileId, auth.user);
        return new Response(
          JSON.stringify({ ...file, progress }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Files Index] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}