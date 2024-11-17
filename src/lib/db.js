import mongoose from 'mongoose';

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

export const getDatabaseStatus = () => ({
  isConnected: mongoose.connection.readyState === CONNECTION_STATES.connected,
  state: mongoose.connection.readyState,
  timestamp: new Date().toISOString()
});

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
    throw new DatabaseError('MONGODB_URI environment variable is not defined', 'ENV_ERROR');
  }

  try {
    console.log('Initializing new database connection...');
    
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

    connectionPromise = mongoose.connect(process.env.MONGODB_URI, options);
    cachedConnection = await connectionPromise;

    console.log('Database connected successfully');

    // Set up error handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      cachedConnection = null;
      connectionPromise = null;
    });

    mongoose.connection.on('disconnected', () => {
      console.error('MongoDB disconnected');
      cachedConnection = null;
      connectionPromise = null;
    });

    return mongoose.connection;

  } catch (error) {
    console.error('Database connection error:', {
      name: error.name,
      message: error.message,
      code: error.code
    });

    cachedConnection = null;
    connectionPromise = null;

    throw new DatabaseError(
      `Failed to connect to database: ${error.message}`,
      error.code || 'CONNECTION_ERROR'
    );
  } finally {
    connectionPromise = null;
  }
}