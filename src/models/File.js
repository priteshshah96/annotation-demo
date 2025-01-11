import mongoose from 'mongoose';

const objectArgumentSchema = new mongoose.Schema({
  'Base Object': { type: String, required: false },
  'Base Modifier': { type: String, required: false },
  'Attached Object': { type: String, required: false },
  'Attached Modifier': { type: String, required: false }
}, { 
  _id: false,
  minimize: true,
  strict: false 
});

const argumentsSchema = new mongoose.Schema({
  Agent: { type: String, required: false },
  Object: { type: objectArgumentSchema, required: false },
  Context: { type: String, required: false },
  Purpose: { type: String, required: false },
  Method: { type: String, required: false },
  Results: { type: String, required: false },
  Analysis: { type: String, required: false },
  Challenge: { type: String, required: false },
  Ethical: { type: String, required: false },
  Implications: { type: String, required: false },
  Contradictions: { type: String, required: false }
}, { 
  _id: false,
  minimize: true,
  strict: false 
});

const eventSchema = new mongoose.Schema({
  eventType: {
    type: Map, // Use a Map to store dynamic event type fields (e.g., Background/Introduction, Methods/Approach, etc.)
    of: String, // Values are strings
    required: false
  },
  Text: { type: String, required: true }, // The main text of the event
  'Main Action': { type: String, required: false }, // Optional main action field
  Arguments: { type: argumentsSchema, required: false } // Nested arguments schema
}, { 
  _id: false,
  minimize: true,
  strict: false 
});

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
  papers: [{
    paper_code: { type: String, required: true }, // Unique identifier for the paper
    abstract: { type: String, required: true }, // Abstract of the paper
    events: [eventSchema] // Array of events associated with the paper
  }],
  uploadDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    totalPapers: { type: Number, default: 0 }, // Total number of papers
    totalEvents: { type: Number, default: 0 } // Total number of events
  },
  progress: { type: Number, default: 0 }, // Upload progress (0-100)
  lastUpdated: { type: Date, default: Date.now } // Timestamp of last update
}, {
  minimize: true,
  strict: false
});

export const File = mongoose.model('File', fileSchema);