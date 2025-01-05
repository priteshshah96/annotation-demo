// src/models/File.js
import mongoose from 'mongoose';

const ArgumentsSchema = new mongoose.Schema({
  Agent: { type: String, default: '' },
  Object: {
    'Base Object': { type: String, default: '' },
    'Base Modifier': { type: String, default: '' },
    'Attached Object': { type: String, default: '' },
    'Attached Modifier': { type: String, default: '' }
  },
  Context: { type: String, default: '' },
  Purpose: { type: String, default: '' },
  Method: { type: String, default: '' },
  Results: { type: String, default: '' },
  Analysis: { type: String, default: '' },
  Challenge: { type: String, default: '' },
  Ethical: { type: String, default: '' },
  Implications: { type: String, default: '' },
  Contradictions: { type: String, default: '' }
}, { _id: false });

const EventSchema = new mongoose.Schema({
  'Background/Introduction': { type: String, default: '' },
  'Methods/Approach': { type: String, default: '' },
  'Results/Findings': { type: String, default: '' },
  'Conclusions/Implications': { type: String, default: '' },
  Text: { type: String, required: true },
  'Main Action': { type: String, default: '' },
  Arguments: { type: ArgumentsSchema, required: true }
}, { _id: false });

const AbstractSchema = new mongoose.Schema({
  paper_code: {
    type: String,
    required: [true, 'Paper code is required'],
    trim: true
  },
  abstract: {
    type: String,
    required: [true, 'Abstract text is required']
  },
  events: {
    type: [EventSchema],
    required: [true, 'Events array is required'],
    validate: {
      validator: function(events) {
        return events.length > 0;
      },
      message: 'At least one event is required'
    }
  }
}, { _id: false });

const FileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  abstracts: {
    type: [AbstractSchema],
    required: [true, 'At least one abstract is required'],
    validate: {
      validator: function(abstracts) {
        return abstracts.length > 0;
      },
      message: 'At least one abstract is required'
    }
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  totalSteps: {
    type: Number,
    required: true,
    min: 0
  }
});

// Method to calculate total steps
FileSchema.methods.calculateTotalSteps = function() {
  let totalSteps = 0;
  
  this.abstracts.forEach(abstract => {
    abstract.events.forEach(event => {
      // Count non-empty event type as one step
      const eventTypes = ['Background/Introduction', 'Methods/Approach', 'Results/Findings', 'Conclusions/Implications'];
      eventTypes.forEach(type => {
        if (event[type]) totalSteps++;
      });
      
      // Count non-empty Main Action
      if (event['Main Action']) totalSteps++;
      
      // Count Arguments fields
      const args = event.Arguments;
      if (args.Agent) totalSteps++;
      if (args.Context) totalSteps++;
      if (args.Purpose) totalSteps++;
      if (args.Method) totalSteps++;
      if (args.Results) totalSteps++;
      if (args.Analysis) totalSteps++;
      if (args.Challenge) totalSteps++;
      if (args.Ethical) totalSteps++;
      if (args.Implications) totalSteps++;
      if (args.Contradictions) totalSteps++;
      
      // Count Object fields
      if (args.Object['Base Object']) totalSteps++;
      if (args.Object['Base Modifier']) totalSteps++;
      if (args.Object['Attached Object']) totalSteps++;
      if (args.Object['Attached Modifier']) totalSteps++;
    });
  });
  
  return totalSteps;
};

// Pre-save middleware to calculate totalSteps
FileSchema.pre('save', function(next) {
  if (!this.totalSteps) {
    this.totalSteps = this.calculateTotalSteps();
  }
  next();
});

export const File = mongoose.models?.File || mongoose.model('File', FileSchema);

export default File;