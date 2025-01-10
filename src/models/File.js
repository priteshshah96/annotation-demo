// File.js - Updated Model
import mongoose from 'mongoose';

const objectArgumentSchema = new mongoose.Schema({
  'Base Object': { type: String },
  'Base Modifier': { type: String },
  'Attached Object': { type: String },
  'Attached Modifier': { type: String }
}, { 
  _id: false,
  minimize: true // Remove empty objects
});

const argumentsSchema = new mongoose.Schema({
  Agent: { type: String },
  Object: { type: objectArgumentSchema },
  Context: { type: String },
  Purpose: { type: String },
  Method: { type: String },
  Results: { type: String },
  Analysis: { type: String },
  Challenge: { type: String },
  Ethical: { type: String },
  Implications: { type: String },
  Contradictions: { type: String }
}, { 
  _id: false,
  minimize: true
});

const eventSchema = new mongoose.Schema({
  'Background/Introduction': { type: String },
  'Methods/Approach': { type: String },
  'Results/Findings': { type: String },
  'Conclusions/Implications': { type: String },
  Text: { type: String, required: true }, // Only this is required
  'Main Action': { type: String },
  Arguments: { type: argumentsSchema }
}, { 
  _id: false,
  minimize: true
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
  abstracts: [{
    paper_code: { type: String, required: true },
    abstract: { type: String, required: true },
    events: [eventSchema]
  }],
  uploadDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    totalAbstracts: { type: Number, default: 0 },
    totalEvents: { type: Number, default: 0 }
  }
}, {
  minimize: true
});

export const File = mongoose.model('File', fileSchema);