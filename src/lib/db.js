import mongoose from 'mongoose';

let cachedConnection = null;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const mongoOptions = {
  maxPoolSize: 1,
  minPoolSize: 0,
  maxIdleTimeMS: 10000, // 10 seconds
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  retryWrites: true,
  w: 'majority',
  keepAlive: true,
  keepAliveInitialDelay: 300000 // 5 minutes
};

// Connection monitoring
mongoose.connection.on('disconnected', () => {
  console.error('[MongoDB] Disconnected');
  cachedConnection = null;
});

mongoose.connection.on('error', (error) => {
  console.error('[MongoDB] Connection error:', error);
  cachedConnection = null;
});

// Safe write operation wrapper
export const safeWrite = async (operation) => {
  try {
    return await operation;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('Duplicate entry detected');
    }
    if (error.name === 'ValidationError') {
      throw new Error(`Validation error: ${error.message}`);
    }
    console.error('[MongoDB] Write operation failed:', error);
    throw error;
  }
};

async function attemptConnection(retryCount = 0) {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log('[MongoDB] Connected successfully');
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection attempt ${retryCount + 1} failed:`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`[MongoDB] Retrying connection in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      return attemptConnection(retryCount + 1);
    }
    
    throw new Error(`Failed to connect to database after ${MAX_RETRIES} attempts: ${error.message}`);
  }
}

export async function connectDB() {
  if (cachedConnection) {
    if (mongoose.connection.readyState === 1) {
      return cachedConnection;
    }
    cachedConnection = null;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    const conn = await attemptConnection();
    cachedConnection = conn;
    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error);
    throw error;
  }
}