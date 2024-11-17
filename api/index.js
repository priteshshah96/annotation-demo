// Edge-compatible API handler
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
  try {
    const auth = await validateAuth(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    if (req.method === 'GET') {
      // Fetch user's files and annotations
      const filesResponse = await fetch(`${MONGODB_URI}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: 'files',
          action: 'find',
          query: { userId: auth.user },
          options: { sort: { createdAt: -1 } }
        })
      });

      if (!filesResponse.ok) {
        throw new Error('Failed to fetch files');
      }

      const files = await filesResponse.json();

      // Get annotation counts for each file
      const annotationsResponse = await fetch(`${MONGODB_URI}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection: 'annotations',
          action: 'aggregate',
          pipeline: [
            { $match: { userId: auth.user } },
            { $group: { _id: '$fileId', count: { $sum: 1 } } }
          ]
        })
      });

      if (!annotationsResponse.ok) {
        throw new Error('Failed to fetch annotation counts');
      }

      const annotationCounts = await annotationsResponse.json();
      const countsMap = Object.fromEntries(
        annotationCounts.map(item => [item._id, item.count])
      );

      // Calculate progress for each file
      const filesWithProgress = files.map(file => ({
        ...file,
        annotationCount: countsMap[file._id] || 0,
        progress: Math.min(
          Math.round((countsMap[file._id] || 0) * 1000 / (file.totalSteps || 1)) / 10,
          100
        )
      }));

      return new Response(
        JSON.stringify({ files: filesWithProgress }),
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
      { 
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('[API Error]:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
