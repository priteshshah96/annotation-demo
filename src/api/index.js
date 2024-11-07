// api/index.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { connectDB } from '../lib/db.js';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from '../models/User.js';

const app = express();

// Middleware Setup
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173', 
      process.env.CLIENT_URL
    ].filter(Boolean);
    callback(null, allowedOrigins);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, {
    headers: req.headers,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// Auth Middleware Definition
const requireAuth = async (req, res, next) => {
  console.log('Starting auth check...');
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Invalid or missing Bearer token');
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted, attempting verification...');
    
    try {
      const decoded = await clerkClient.verifyToken(token);
      console.log('Token verified successfully for user:', decoded.sub);
      
      req.auth = {
        userId: decoded.sub,
        sessionId: decoded.sid,
        session: decoded
      };

      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({
        error: 'Invalid token',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
};

const withUserSync = async (req, res, next) => {
  console.log('Starting user sync...');
  try {
    if (!req.auth?.userId) {
      console.log('No userId found in auth context');
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Authentication required'
      });
    }

    await connectDB();

    console.log('Fetching Clerk user details for:', req.auth.userId);
    const clerkUser = await clerkClient.users.getUser(req.auth.userId);
    console.log('Clerk user fetched:', {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName
    });
    
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    let user = await User.findOne({ clerkId: req.auth.userId });
    console.log('Existing user found:', !!user);
    
    if (!user) {
      console.log('Creating new user in MongoDB...');
      const userData = {
        clerkId: req.auth.userId,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        createdAt: new Date(),
        lastLoginAt: new Date()
      };
      
      user = new User(userData);
      await user.save();
      console.log('New user created with ID:', user._id);
    } else {
      console.log('Updating existing user...');
      user.email = clerkUser.emailAddresses[0]?.emailAddress;
      user.firstName = clerkUser.firstName;
      user.lastName = clerkUser.lastName;
      user.lastLoginAt = new Date();
      await user.save();
      console.log('User updated successfully');
    }

    req.user = user;
    console.log('User sync completed successfully');
    next();
  } catch (error) {
    console.error('User sync error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({
      error: 'User synchronization failed',
      details: error.message,
      code: error.code
    });
  }
};

// Combined middleware
const authenticateAndSync = [requireAuth, withUserSync];

// Basic test route
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'Server is reachable' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Export handler for Vercel
export default async function handler(req, res) {
  // Connect to database if needed
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  
  return app(req, res);
}