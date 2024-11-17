# Annotation Demo Web Application

## Error Logging Setup

### Supabase Configuration

This project uses Supabase for centralized error logging in production environments. To set this up:

1. Create a Supabase project
2. Set up an `error_logs` table with the following schema:
   ```sql
   CREATE TABLE error_logs (
     id SERIAL PRIMARY KEY,
     error_message TEXT,
     error_details JSONB,
     location TEXT,
     timestamp TIMESTAMPTZ,
     environment TEXT
   );
   ```

3. Set the following environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

### Error Tracking Mechanism

- Errors are automatically logged in production via the `/api/vercel/error/log` endpoint
- Captured details include error message, stack trace, and page location
- Logs are stored in Supabase for monitoring and analysis

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run the application: `npm run dev`

## Production Deployment

Deployed on Vercel with automatic error tracking and logging.
