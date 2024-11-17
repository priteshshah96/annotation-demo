import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { error, errorInfo, location } = req.body;

    // Log error to Supabase
    const { data, error: insertError } = await supabase
      .from('error_logs')
      .insert({
        error_message: error,
        error_details: JSON.stringify(errorInfo),
        location,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      });

    if (insertError) {
      console.error('Supabase Error Logging Failed:', insertError);
      return res.status(500).json({ message: 'Error logging failed', details: insertError });
    }

    return res.status(200).json({ message: 'Error logged successfully' });
  } catch (err) {
    console.error('Unexpected error in error logging:', err);
    return res.status(500).json({ message: 'Unexpected error in logging', details: err.message });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
