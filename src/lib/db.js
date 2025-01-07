// src/lib/db.js
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { File } from '../models/File.js';
import { Annotation } from '../models/Annotation.js';
// db.js
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.VITE_MONGODB_URI;


if (!MONGODB_URI) {
  throw new Error('Please define the VITE_MONGODB_URI or MONGODB_URI environment variable');
}

// Cache the connection to avoid reconnecting on every request
let cached = {
  conn: null,
  promise: null
};

export async function connectDB() {
  if (cached.conn) {
    // If a connection already exists, return it
    return cached.conn;
  }

  if (!cached.promise) {
    // Define connection options
    const opts = {
      bufferCommands: false, // Disable mongoose buffering
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 30000, // 30 seconds connection timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      retryWrites: true, // Retry write operations on failure
      w: 'majority', // Write concern: majority
      retryReads: true, // Retry read operations on failure
      serverSelectionTimeoutMS: 60000, // 60 seconds server selection timeout
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 0, // Minimum number of connections in the pool
    };

    // Create a new connection promise
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then(mongoose => {
        console.log('MongoDB connected successfully');

        // Ensure collections are created explicitly
        ensureCollectionsExist();

        return mongoose;
      })
      .catch(error => {
        console.error('MongoDB connection error details:', {
          name: error.name,
          message: error.message,
          code: error.code,
          uri: MONGODB_URI ? MONGODB_URI.replace(/\/\/[^@]+@/, '//****:****@') : 'not set'
        });
        // Clear the promise cache to allow retries
        cached.promise = null;
        throw error;
      });
  }

  try {
    // Wait for the connection promise to resolve
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    // Clear the promise cache if an error occurs
    cached.promise = null;
    throw e;
  }
}

// Function to ensure collections exist
function ensureCollectionsExist() {
  // Create collections if they don't exist
  const db = mongoose.connection.db;

  // Ensure User collection exists
  db.listCollections({ name: 'users' })
    .next(async (err, collinfo) => {
      if (!collinfo) {
        console.log('Creating User collection...');
        await User.createCollection();
      }
    });

  // Ensure File collection exists
  db.listCollections({ name: 'files' })
    .next(async (err, collinfo) => {
      if (!collinfo) {
        console.log('Creating File collection...');
        await File.createCollection();
      }
    });

  // Ensure Annotation collection exists
  db.listCollections({ name: 'annotations' })
    .next(async (err, collinfo) => {
      if (!collinfo) {
        console.log('Creating Annotation collection...');
        await Annotation.createCollection();
      }
    });
}

export default connectDB;