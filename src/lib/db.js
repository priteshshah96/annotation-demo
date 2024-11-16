import mongoose from 'mongoose';
import { createHash } from 'crypto';

let cachedConnection = null;
let connectionPromise = null;

const CONNECTION_STATES = {
  disconnected: 0,
  connected: 1,
  connecting: 2,
  disconnecting: 3,
};

class DatabaseError extends Error {
  constructor(message, code = 'DB_ERROR') {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

export async function connectDB() {
  // If we're already connected, return the existing connection
  if (cachedConnection?.readyState === CONNECTION_STATES.connected) {
    console.log('Using existing database connection');
    return cachedConnection;
  }

  // If we're connecting, wait for the existing promise
  if (connectionPromise) {
    console.log('Waiting for existing connection attempt...');
    return connectionPromise;
  }

  if (!process.env.MONGODB_URI) {
    throw new DatabaseError('MONGODB_URI environment variable is not defined', 'ENV_ERROR');
  }

  try {
    // Configure Mongoose options for Vercel environment
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,    // Increased for Vercel
      socketTimeoutMS: 60000,             // Increased for Vercel
      connectTimeoutMS: 30000,            // Increased for Vercel
      maxPoolSize: 50,                    // Adjusted for serverless
      minPoolSize: 10,                    // Minimum connections
      maxIdleTimeMS: 60000,              // Keep connections alive longer
      heartbeatFrequencyMS: 15000,       // More frequent heartbeats
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

    console.log('Initializing new database connection...', {
      uri: process.env.MONGODB_URI.split('@')[1], // Log only host part for security
      options: { ...options, ssl: undefined, tls: undefined } // Remove sensitive data
    });

    // Create connection promise
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, options);

    // Wait for connection
    cachedConnection = await connectionPromise;
    console.log('Database connected successfully');

    // Set up connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', {
        name: err.name,
        message: err.message,
        code: err.code
      });

      // Reset cache on critical errors
      if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
        cachedConnection = null;
        connectionPromise = null;
      }
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected, clearing connection cache');
      cachedConnection = null;
      connectionPromise = null;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Monitor connection health
    setInterval(() => {
      if (mongoose.connection.readyState !== CONNECTION_STATES.connected) {
        console.warn('Database connection health check failed:', {
          state: mongoose.connection.readyState,
          timestamp: new Date().toISOString()
        });
      }
    }, 30000);

    return cachedConnection;

  } catch (error) {
    console.error('Database connection error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    // Reset connection state
    cachedConnection = null;
    connectionPromise = null;

    // Throw enhanced error
    throw new DatabaseError(
      `Failed to connect to database: ${error.message}`,
      error.code || 'CONNECTION_ERROR'
    );
  } finally {
    // Clear connection promise
    connectionPromise = null;
  }
}

// Graceful shutdown handlers
['SIGTERM', 'SIGINT', 'beforeExit'].forEach(signal => {
  process.on(signal, async () => {
    try {
      if (mongoose.connection.readyState === CONNECTION_STATES.connected) {
        console.log(`Closing MongoDB connection due to ${signal}`);
        await mongoose.connection.close();
        console.log('MongoDB connection closed successfully');
      }
    } catch (err) {
      console.error('Error during database shutdown:', err);
    } finally {
      process.exit(0);
    }
  });
});

// Optional: Add connection status checker
export function getDatabaseStatus() {
  return {
    isConnected: mongoose.connection.readyState === CONNECTION_STATES.connected,
    state: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  };
}