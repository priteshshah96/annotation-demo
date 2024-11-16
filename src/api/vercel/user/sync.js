import { clerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from '../../../lib/db.js';
import { User } from '../../../models/User.js';

// Remove edge runtime as it's not optimal for MongoDB operations
// export const config = {
//   runtime: 'edge'
// };

// Consistent response helper
const createResponse = (data, status = 200) => {
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_CLERK_FRONTEND_API || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json',
    // Add security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  return new Response(JSON.stringify(data), { 
    status, 
    headers 
  });
};

export default async function handler(req) {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return createResponse(null, 204);
  }

  let mongoConnection = null;

  try {
    // Connect to MongoDB with connection pooling
    mongoConnection = await connectDB();

    // Validate authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return createResponse({
        success: false,
        error: 'Missing or invalid authorization header'
      }, 401);
    }

    const token = authHeader.split(' ')[1];
    
    // Verify Clerk token
    let decoded;
    try {
      decoded = await clerkClient.verifyToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return createResponse({
        success: false,
        error: 'Invalid authentication token',
        code: error.code || 'INVALID_TOKEN'
      }, 401);
    }

    const userId = decoded.sub;

    // Get user details from Clerk
    const clerkUser = await clerkClient.users.getUser(userId).catch(error => {
      console.error('Failed to fetch Clerk user:', error);
      throw new Error('User not found in Clerk');
    });

    // Get primary email
    const primaryEmail = clerkUser.emailAddresses.find(email => 
      email.id === clerkUser.primaryEmailAddressId
    );

    if (!primaryEmail?.emailAddress) {
      return createResponse({
        success: false,
        error: 'No primary email found for user'
      }, 400);
    }

    // Update or create user in MongoDB with retry logic
    let user;
    let retries = 3;
    
    while (retries > 0) {
      try {
        user = await User.findOneAndUpdate(
          { clerkId: userId },
          {
            $set: {
              email: primaryEmail.emailAddress,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              lastLoginAt: new Date()
            },
            $setOnInsert: { 
              createdAt: new Date()
            }
          },
          { 
            upsert: true, 
            new: true,
            runValidators: true,
            maxTimeMS: 5000 // 5 second timeout
          }
        );
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Success response
    return createResponse({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    // Log error details
    console.error('Sync endpoint error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    // Determine error status
    let status = error.status || 500;
    if (error.code === 11000) status = 409;
    if (error.name === 'ValidationError') status = 400;

    return createResponse({
      success: false,
      error: error.message || 'Internal server error',
      code: error.code || 'SYNC_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, status);

  } finally {
    // Cleanup MongoDB connection if needed
    if (mongoConnection?.connection?.readyState === 1) {
      // Keep connection alive for serverless environment
      // MongoDB driver will handle connection pooling
    }
  }
}