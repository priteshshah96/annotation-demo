import { connectDB } from '../src/lib/db';

// Edge-compatible API utilities
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

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const auth = await validateAuth(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user's files
    const filesResponse = await fetch(`${MONGODB_URI}/api/data`, {
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

    if (!filesResponse.ok) {
      throw new Error('Failed to fetch files');
    }

    const files = await filesResponse.json();

    // Get annotations for each file
    const annotationsPromises = files.map(file => 
      fetch(`${MONGODB_URI}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: 'annotations',
          action: 'count',
          query: { fileId: file._id }
        })
      }).then(res => res.json())
    );

    const annotationCounts = await Promise.all(annotationsPromises);

    // Combine files with their annotation counts
    const filesWithProgress = files.map((file, index) => ({
      ...file,
      progress: Math.min((annotationCounts[index] * 100) / file.totalSteps, 100)
    }));

    return new Response(
      JSON.stringify({
        files: filesWithProgress,
        user: auth.user
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('[API] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
