// Edge-compatible error logging handler
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

async function logToSupabase(level, message, context = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase configuration is missing. Error logging is disabled.');
    return null;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('logs')
      .insert([{
        level,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        context: context,
        timestamp: new Date().toISOString()
      }]);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to log to Supabase:', error);
    return null;
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { level = 'error', message, context = {} } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Add request metadata to context
    const enrichedContext = {
      ...context,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    };

    // Log to Supabase
    await logToSupabase(level, message, enrichedContext);

    // Also log to console for development/debugging
    console[level](`[${level.toUpperCase()}]`, message, enrichedContext);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Error Logger] Failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to log error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
