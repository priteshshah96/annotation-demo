import mongoose from 'mongoose';

// Define a flexible schema for nested objects
const nestedObjectSchema = new mongoose.Schema({}, { 
  _id: false, // Disable automatic _id generation for nested objects
  strict: false, // Allow any fields in the nested object
  minimize: false // Preserve empty objects
});

// Define the event schema
const eventSchema = new mongoose.Schema({
  // Allow any fields in the event object
}, { 
  _id: false, // Disable automatic _id generation for events
  strict: false, // Allow any fields in the event object
  minimize: false // Preserve empty objects
});

// Define the paper schema
const paperSchema = new mongoose.Schema({
  paper_code: { type: String, required: true }, // Required field
  abstract: { type: String, required: true }, // Required field
  events: [eventSchema] // Array of events (flexible structure)
}, { 
  _id: false, // Disable automatic _id generation for papers
  strict: false, // Allow any fields in the paper object
  minimize: false // Preserve empty objects
});

// Define the file schema
const fileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: true
  },
  papers: [paperSchema], // Array of papers (flexible structure)
  uploadDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    totalPapers: { type: Number, default: 0 }, // Total number of papers
    totalEvents: { type: Number, default: 0 } // Total number of events
  },
  lastUpdated: { type: Date, default: Date.now } // Timestamp of last update
}, {
  strict: false, // Allow any fields in the file object
  minimize: false // Preserve empty objects
});

// Create the model
export const File = mongoose.model('File', fileSchema);