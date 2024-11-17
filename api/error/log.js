// Edge-compatible error logging handler
const LOG_API_URL = process.env.LOG_API_URL || process.env.NEXT_PUBLIC_LOG_API_URL;
const LOG_API_KEY = process.env.LOG_API_KEY;

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

async function logError(level, message, context = {}) {
  if (!LOG_API_URL) {
    console.warn('Log API configuration is missing. Error logging is disabled.');
    return null;
  }

  try {
    const response = await fetch(LOG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOG_API_KEY}`,
      },
      body: JSON.stringify({
        level,
        message,
        context,
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'development'
      })
    });

    if (!response.ok) {
      console.error('Failed to log error:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error logging failed:', error);
    return null;
  }
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
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
    }

    const data = await req.json();
    const { level = 'error', message, context } = data;

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const result = await logError(level, message, context);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('Error handler failed:', error);
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
