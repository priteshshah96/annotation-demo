// src/lib/db.js
import mongoose from 'mongoose';

const MONGODB_URI = import.meta.env.VITE_MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the VITE_MONGODB_URI environment variable');
}

let cached = {
  conn: null,
  promise: null
};

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      ssl: true,
      retryWrites: true,
      w: 'majority',
      retryReads: true,
      serverSelectionTimeoutMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 0,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(mongoose => {
      console.log('MongoDB connected successfully');
      return mongoose;
    }).catch(error => {
      console.error('MongoDB connection error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        uri: MONGODB_URI ? MONGODB_URI.replace(/\/\/[^@]+@/, '//****:****@') : 'not set'
      });
      cached.promise = null;
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
}

export default connectDB;