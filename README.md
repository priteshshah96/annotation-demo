# Annotation Demo Web Application

## Error Logging

### Approach
- Errors are automatically logged via the `/api/vercel/error/log` endpoint
- Captured details include error message, stack trace, and page location
- Logs are tracked in Vercel console and application logs

### Logging Mechanism
- Console-based error tracking for internal tool
- Minimal external dependencies
- Lightweight error reporting

## Environment Variables

### Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### Notes
- Ensure you keep your service role key confidential

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run the application: `npm run dev`

## Production Deployment

Deployed on Vercel with automatic error tracking and logging.
