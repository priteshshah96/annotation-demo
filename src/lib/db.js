import mongoose from 'mongoose';
import { createHash } from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const getCacheKey = (uri) => {
  return createHash('md5').update(uri).digest('hex');
}

const cacheKey = getCacheKey(MONGODB_URI);
global.mongoose = global.mongoose || {};
let cached = global.mongoose[cacheKey];

if (!cached) {
  cached = global.mongoose[cacheKey] = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    console.log('Using cached database connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,    // Increased from 5000
      socketTimeoutMS: 45000,             // Increased from 30000
      connectTimeoutMS: 15000,            // Increased from 10000
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,              // Increased from 10000
      heartbeatFrequencyMS: 10000,       // Increased from 5000
      ssl: true,
      tls: true,
      retryWrites: true,
      w: 'majority',
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      }
    };

    console.log('Creating new database connection...');
    
    try {
      cached.promise = mongoose.connect(MONGODB_URI, opts);
      cached.conn = await cached.promise;
      console.log('Database connected successfully');
      
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB error event:', err);
        if (err.name === 'MongoNetworkError') {
          cached.conn = null;
          cached.promise = null;
        }
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected, clearing cache');
        cached.conn = null;
        cached.promise = null;
      });

      return cached.conn;
    } catch (error) {
      console.error('Connection error:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
      cached.promise = null;
      cached.conn = null;
      throw error;
    }
  }

  try {
    return await cached.promise;
  } catch (error) {
    console.error('Cached promise error:', error);
    cached.promise = null;
    throw error;
  }
}

['SIGTERM', 'SIGINT', 'beforeExit'].forEach(signal => {
  process.on(signal, async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through', signal);
    }
    process.exit(0);
  });
});