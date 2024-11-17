import mongoose from 'mongoose';

let cachedConnection = null;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function attemptConnection(retryCount = 0) {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
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
    });

    console.log('DB Connected successfully');
    return conn;
  } catch (error) {
    console.error(`DB Connection attempt ${retryCount + 1} failed:`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying connection in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return attemptConnection(retryCount + 1);
    }
    
    throw new Error(`Failed to connect to database after ${MAX_RETRIES} attempts: ${error.message}`);
  }
}

export async function connectDB() {
  if (cachedConnection) {
    // Check if the connection is still valid
    if (mongoose.connection.readyState === 1) {
      return cachedConnection;
    }
    // Reset cached connection if it's not valid
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
    console.error('DB Connection error:', error);
    // Clear cached connection on error
    cachedConnection = null;
    throw error;
  }
}