// src/models/File.js
import mongoose from 'mongoose';

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
  abstracts: [{
    paper_code: String,
    abstract: String,
    sentences: [{
      sentence_code: String,
      text: String,
      scientific_entities: [{
        entity: String
      }]
    }]
  }],
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
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

export const File = mongoose.model('File', FileSchema);