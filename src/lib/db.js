import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      maxIdleTimeMS: 10000, // 10 seconds
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });

    isConnected = true;
    console.log('DB Connected');
  } catch (error) {
    console.error('DB Connection error:', error);
    throw error;
  }
}