import mongoose from 'mongoose';

// Define the Arguments schema
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

// Define the Event schema
const EventSchema = new mongoose.Schema({
  // Event type fields (only one should be present)
  'Background/Introduction': { type: String, default: '' },
  'Methods/Approach': { type: String, default: '' },
  'Results/Findings': { type: String, default: '' },
  'Conclusions/Implications': { type: String, default: '' },

  // Event-level text field
  Text: { type: String, required: true },

  // Main Action field
  'Main Action': { type: String, required: true },

  // Arguments object
  Arguments: { type: ArgumentsSchema, required: true },

  // Track if the event is annotated
  isAnnotated: { type: Boolean, default: false }
}, { _id: false });

// Define the Abstract schema
const AbstractSchema = new mongoose.Schema({
  // Paper code (required)
  paper_code: {
    type: String,
    required: [true, 'Paper code is required'],
    trim: true
  },

  // Abstract text (required)
  abstract: {
    type: String,
    required: [true, 'Abstract text is required']
  },

  // Events array (required, with at least one event)
  events: {
    type: [EventSchema],
    required: [true, 'Events array is required'],
    validate: {
      validator: function(events) {
        return events.length > 0; // At least one event is required
      },
      message: 'At least one event is required'
    }
  }
}, { _id: false });

// Define the File schema
const FileSchema = new mongoose.Schema({
  // User ID (required)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // File name (required)
  name: {
    type: String,
    required: true,
    trim: true
  },

  // Abstracts array (required, with at least one abstract)
  abstracts: {
    type: [AbstractSchema],
    required: [true, 'At least one abstract is required'],
    validate: {
      validator: function(abstracts) {
        return abstracts.length > 0; // At least one abstract is required
      },
      message: 'At least one abstract is required'
    }
  },

  // Progress (default: 0, range: 0-100)
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Upload date (default: current date)
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

// Method to calculate total abstracts and events
FileSchema.methods.getAnnotationStats = function() {
  const totalAbstracts = this.abstracts.length;
  const totalEvents = this.abstracts.reduce((sum, abstract) => sum + abstract.events.length, 0);

  return {
    totalAbstracts,
    totalEvents
  };
};

// Method to update progress
FileSchema.methods.updateProgress = function() {
  const totalEvents = this.abstracts.reduce((sum, abstract) => sum + abstract.events.length, 0);
  const annotatedEvents = this.abstracts.reduce((sum, abstract) => {
    return sum + abstract.events.filter(event => event.isAnnotated).length;
  }, 0);

  this.progress = totalEvents > 0 ? Math.round((annotatedEvents / totalEvents) * 100) : 0;
};

// Pre-save middleware to update progress
FileSchema.pre('save', function(next) {
  this.updateProgress();
  next();
});

// Export the File model
export const File = mongoose.models?.File || mongoose.model('File', FileSchema);

export default File;