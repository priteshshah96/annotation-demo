import { createClient } from '@supabase/supabase-js';

// Safely initialize Supabase client with fallback
const initSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('Supabase configuration is missing. Error logging will be disabled.');
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseServiceRoleKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { 
      error, 
      errorInfo, 
      location, 
      userAgent, 
      timestamp,
      additionalContext 
    } = req.body;

    // Simple console logging for development
    console.error('Development Error Log:', {
      errorMessage: error?.toString() || 'Unknown Error',
      errorDetails: {
        ...errorInfo,
        additionalContext
      },
      location,
      timestamp: timestamp || new Date().toISOString()
    });

    return res.status(200).json({ 
      message: 'Error logged successfully',
      tracked: true 
    });
  } catch (err) {
    console.error('Error logging failed:', err);
    return res.status(500).json({ 
      message: 'Error logging failed', 
      details: err.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
