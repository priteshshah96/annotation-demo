import mongoose from 'mongoose';

let cachedConnection = null;
let connectionPromise = null;

const CONNECTION_STATES = {
  disconnected: 0,
  connected: 1,
  connecting: 2,
  disconnecting: 3,
};

export async function connectDB() {
  // Fast path: return existing connection
  if (mongoose.connections[0].readyState === CONNECTION_STATES.connected) {
    console.log('Using existing database connection');
    return mongoose.connection;
  }

  // If we're connecting, wait for the existing promise
  if (connectionPromise) {
    console.log('Waiting for existing connection attempt...');
    return connectionPromise;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    // Optimized options for serverless
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 1,
      minPoolSize: 0,
      maxIdleTimeMS: 5000,
      heartbeatFrequencyMS: 5000,
      ssl: true,
      tls: true,
      retryWrites: true,
      w: 'majority'
    };

    console.log('Initializing new database connection...');
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, options);
    cachedConnection = await connectionPromise;

    console.log('Database connected successfully');
    return mongoose.connection;

  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  } finally {
    connectionPromise = null;
  }
}