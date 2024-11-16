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
    // Optimized options for serverless
    const options = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,    // Reduced from 15000
      socketTimeoutMS: 10000,            // Reduced from 60000
      connectTimeoutMS: 10000,           // Reduced from 30000
      maxPoolSize: 1,                    // Reduced from 50
      minPoolSize: 0,                    // Reduced from 10
      maxIdleTimeMS: 5000,              // Reduced from 60000
      heartbeatFrequencyMS: 5000,       // Reduced from 15000
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

    console.log('Initializing new database connection...');

    // Create connection promise
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, options);

    // Wait for connection with timeout
    const connectionTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 9000);
    });

    cachedConnection = await Promise.race([
      connectionPromise,
      connectionTimeout
    ]);

    console.log('Database connected successfully');

    // Simplified error handling
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', {
        name: err.name,
        message: err.message
      });
      cachedConnection = null;
      connectionPromise = null;
    });

    mongoose.connection.on('disconnected', () => {
      cachedConnection = null;
      connectionPromise = null;
    });

    // Return the connection
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

// Simplified status checker
export function getDatabaseStatus() {
  return {
    isConnected: mongoose.connection.readyState === CONNECTION_STATES.connected,
    state: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  };
}

// Clean up on module unload
process.on('beforeExit', async () => {
  if (mongoose.connection.readyState === CONNECTION_STATES.connected) {
    await mongoose.connection.close();
  }
});