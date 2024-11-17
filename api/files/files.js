// Edge-compatible files handler
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

async function handleListFiles(auth) {
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
  return files;
}

async function handleGetFile(fileId, auth) {
  const response = await fetch(`${MONGODB_URI}/api/data`, {
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

  if (!response.ok) {
    throw new Error('Failed to fetch file');
  }

  const file = await response.json();
  if (!file) {
    throw new Error('File not found');
  }

  return file;
}

async function handleDeleteFile(fileId, auth) {
  // First check if file exists and belongs to user
  const file = await handleGetFile(fileId, auth);

  // Delete file
  const deleteResponse = await fetch(`${MONGODB_URI}/api/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: 'files',
      action: 'deleteOne',
      query: { _id: fileId, userId: auth.user }
    })
  });

  if (!deleteResponse.ok) {
    throw new Error('Failed to delete file');
  }

  // Delete associated annotations
  await fetch(`${MONGODB_URI}/api/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: 'annotations',
      action: 'deleteMany',
      query: { fileId }
    })
  });

  return { success: true };
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
      if (fileId) {
        const file = await handleGetFile(fileId, auth);
        return new Response(
          JSON.stringify(file),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        const files = await handleListFiles(auth);
        return new Response(
          JSON.stringify(files),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'DELETE' && fileId) {
      const result = await handleDeleteFile(fileId, auth);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Files] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}