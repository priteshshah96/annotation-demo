// database-check.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User.js';

dotenv.config();

const verifyDatabase = async () => {
  try {
    console.log('\n=== Database Verification ===');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.VITE_MONGODB_URI);
    
    // Get database information
    const dbName = mongoose.connection.db.databaseName;
    console.log('Current Database:', dbName);
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Check User collection specifically
    const userCollection = collections.find(c => c.name === 'users');
    if (!userCollection) {
      console.log('\n❌ Users collection not found!');
    } else {
      console.log('\n✅ Users collection exists');
      
      // Count documents in Users collection
      const userCount = await User.countDocuments();
      console.log('Documents in Users collection:', userCount);
      
      // Get sample user
      const sampleUser = await User.findOne();
      if (sampleUser) {
        console.log('\nSample user document:');
        console.log(JSON.stringify(sampleUser, null, 2));
      }
    }
    
    // Test inserting a document
    const testUser = new User({
      clerkId: 'test_' + Date.now(),
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date(),
      lastLoginAt: new Date()
    });
    
    console.log('\nAttempting to insert test document...');
    await testUser.save();
    console.log('✅ Test document inserted successfully');
    
    // Verify the test document
    const insertedUser = await User.findOne({ clerkId: testUser.clerkId });
    console.log('\nRetrieved test document:');
    console.log(JSON.stringify(insertedUser, null, 2));
    
    // Clean up test document
    await User.deleteOne({ clerkId: testUser.clerkId });
    console.log('\n✅ Test document cleaned up');
    
  } catch (error) {
    console.error('\n❌ Database verification error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Run the verification
verifyDatabase();