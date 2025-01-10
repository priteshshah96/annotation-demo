// src/services/fileApi.js
import { api } from '../lib/api';

// Constants for field validation
const EVENT_TYPES = [
  'Background/Introduction',
  'Methods/Approach', 
  'Results/Findings',
  'Conclusions/Implications'
];

const ARGUMENT_FIELDS = [
  'Agent',
  'Context',
  'Purpose',
  'Method',
  'Results',
  'Analysis',
  'Challenge',
  'Ethical',
  'Implications',
  'Contradictions'
];

const OBJECT_FIELDS = [
  'Base Object',
  'Base Modifier',
  'Attached Object',
  'Attached Modifier'
];

// Utility function to format event data - only include fields that exist
// Utility function to format event data
const formatEvent = (event = {}) => {
  const formattedEvent = {
    Text: event.Text // Text is always required
  };

  // Add event type field only if it exists in the input
  if ('Background/Introduction' in event) {
    formattedEvent['Background/Introduction'] = event['Background/Introduction'];
  }
  if ('Methods/Approach' in event) {
    formattedEvent['Methods/Approach'] = event['Methods/Approach'];
  }
  if ('Results/Findings' in event) {
    formattedEvent['Results/Findings'] = event['Results/Findings'];
  }
  if ('Conclusions/Implications' in event) {
    formattedEvent['Conclusions/Implications'] = event['Conclusions/Implications'];
  }

  // Add Main Action only if it exists in the input
  if ('Main Action' in event) {
    formattedEvent['Main Action'] = event['Main Action'];
  }

  // Add Arguments only if they exist in the input
  if ('Arguments' in event) {
    formattedEvent.Arguments = {};
    
    // Copy Arguments fields only if they exist
    if ('Agent' in event.Arguments) {
      formattedEvent.Arguments.Agent = event.Arguments.Agent;
    }
    if ('Context' in event.Arguments) {
      formattedEvent.Arguments.Context = event.Arguments.Context;
    }
    if ('Purpose' in event.Arguments) {
      formattedEvent.Arguments.Purpose = event.Arguments.Purpose;
    }
    if ('Method' in event.Arguments) {
      formattedEvent.Arguments.Method = event.Arguments.Method;
    }
    if ('Results' in event.Arguments) {
      formattedEvent.Arguments.Results = event.Arguments.Results;
    }
    if ('Analysis' in event.Arguments) {
      formattedEvent.Arguments.Analysis = event.Arguments.Analysis;
    }
    if ('Challenge' in event.Arguments) {
      formattedEvent.Arguments.Challenge = event.Arguments.Challenge;
    }
    if ('Ethical' in event.Arguments) {
      formattedEvent.Arguments.Ethical = event.Arguments.Ethical;
    }
    if ('Implications' in event.Arguments) {
      formattedEvent.Arguments.Implications = event.Arguments.Implications;
    }
    if ('Contradictions' in event.Arguments) {
      formattedEvent.Arguments.Contradictions = event.Arguments.Contradictions;
    }

    // Handle Object fields only if they exist
    if ('Object' in event.Arguments) {
      formattedEvent.Arguments.Object = {};
      
      if ('Base Object' in event.Arguments.Object) {
        formattedEvent.Arguments.Object['Base Object'] = event.Arguments.Object['Base Object'];
      }
      if ('Base Modifier' in event.Arguments.Object) {
        formattedEvent.Arguments.Object['Base Modifier'] = event.Arguments.Object['Base Modifier'];
      }
      if ('Attached Object' in event.Arguments.Object) {
        formattedEvent.Arguments.Object['Attached Object'] = event.Arguments.Object['Attached Object'];
      }
      if ('Attached Modifier' in event.Arguments.Object) {
        formattedEvent.Arguments.Object['Attached Modifier'] = event.Arguments.Object['Attached Modifier'];
      }

      // Remove Object if it's empty
      if (Object.keys(formattedEvent.Arguments.Object).length === 0) {
        delete formattedEvent.Arguments.Object;
      }
    }

    // Remove Arguments if they're empty
    if (Object.keys(formattedEvent.Arguments).length === 0) {
      delete formattedEvent.Arguments;
    }
  }

  return formattedEvent;
};

// Utility function to calculate total steps
const calculateTotalSteps = (content) => {
  return content.reduce((totalSteps, abstract) => {
    return totalSteps + (abstract.events?.reduce((eventSteps, event) => {
      eventSteps += EVENT_TYPES.filter(type => event[type]).length;
      if (event['Main Action']) eventSteps++;
      eventSteps += ARGUMENT_FIELDS.filter(field => event.Arguments?.[field]).length;
      eventSteps += OBJECT_FIELDS.filter(field => event.Arguments?.Object?.[field]).length;
      return eventSteps;
    }, 0) || 0);
  }, 0);
};

// Cache configuration for stats
const STATS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cachedStats = null;
let lastFetchTime = null;

export const fileApi = {
  async uploadFile(fileData) {
    try {
      this.validateFileData(fileData);
      const formattedContent = this.formatFileContent(fileData.content);
      const totalSteps = calculateTotalSteps(formattedContent);

      const uploadData = {
        name: fileData.name,
        content: formattedContent,
        userId: fileData.userId,
        metadata: {
          totalAbstracts: formattedContent.length,
          totalEvents: formattedContent.reduce((sum, abstract) => 
            sum + (abstract.events?.length || 0), 0)
        },
        totalSteps
      };

      return await api.files.upload(uploadData);
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  validateFileData(fileData) {
    if (!fileData.content || !Array.isArray(fileData.content)) {
      throw new Error('Invalid file content: expected an array of abstracts');
    }

    fileData.content.forEach((abstract, index) => {
      if (!abstract.paper_code || !abstract.abstract) {
        throw new Error(`Abstract ${index + 1} must have paper_code and abstract fields`);
      }
      if (!Array.isArray(abstract.events)) {
        throw new Error(`Abstract ${index + 1} must have an events array`);
      }
      if (abstract.events.length === 0) {
        throw new Error(`Abstract ${index + 1} must have at least one event`);
      }

      // Validate required Text field in events
      abstract.events.forEach((event, eventIndex) => {
        if (!event.Text) {
          throw new Error(`Abstract ${index + 1}, Event ${eventIndex + 1}: Missing Text field`);
        }
      });
    });
  },

  formatFileContent(content) {
    return content.map(abstract => ({
      paper_code: abstract.paper_code,
      abstract: abstract.abstract,
      events: (abstract.events || []).map(event => formatEvent(event))
    }));
  },

  async getFiles() {
    try {
      const response = await api.files.getAll();
      if (!response.files) {
        throw new Error('Invalid response: files not found');
      }

      return {
        files: this.processFiles(response.files),
        totalFiles: response.totalFiles
      };
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },

  processFiles(files) {
    return files.map(file => ({
      _id: file._id,
      name: file.name,
      abstracts: file.abstracts,
      totalAbstracts: file.abstracts?.length || 0,
      totalEvents: file.abstracts?.reduce((sum, abstract) => 
        sum + (abstract.events?.length || 0), 0) || 0,
      progress: file.progress || 0,
      uploadDate: file.uploadDate,
      metadata: file.metadata || {}
    }));
  },

  async deleteFile(fileId) {
    try {
      return await api.files.delete(fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  async getFile(fileId) {
    try {
      const response = await api.files.get(fileId);
      if (!response?.file) {
        throw new Error('File not found');
      }

      return { 
        success: true, 
        file: {
          file_name: response.file.name,
          export_date: new Date().toISOString(),
          abstracts: response.file.abstracts.map(abstract => ({
            paper_code: abstract.paper_code,
            abstract: abstract.abstract,
            events: abstract.events.map(event => formatEvent(event))
          }))
        }
      };
    } catch (error) {
      console.error('Error fetching file:', error);
      throw error;
    }
  },

  async exportFile(fileId) {
    try {
      const response = await this.getFile(fileId);
      if (!response?.success || !response?.file) {
        throw new Error('Failed to export file');
      }

      return {
        data: response.file,
        fileName: response.file.file_name.replace('.json', '_annotated.json')
      };
    } catch (error) {
      console.error('Error exporting file:', error);
      throw error;
    }
  },

  async getUserStats() {
    if (this.isStatsCacheValid()) {
      return cachedStats;
    }

    try {
      const response = await this.getFiles();
      const files = response.files || [];
      cachedStats = this.calculateStats(files);
      lastFetchTime = Date.now();
      return cachedStats;
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return this.getEmptyStats();
    }
  },

  isStatsCacheValid() {
    return cachedStats && 
           lastFetchTime && 
           (Date.now() - lastFetchTime < STATS_CACHE_DURATION);
  },

  calculateStats(files) {
    return files.reduce((acc, file) => ({
      totalAbstracts: acc.totalAbstracts + (file.totalAbstracts || 0),
      totalEvents: acc.totalEvents + (file.totalEvents || 0),
      annotatedEvents: acc.annotatedEvents + 
        Math.floor((file.progress || 0) * file.totalEvents / 100),
      completedFiles: acc.completedFiles + (file.progress === 100 ? 1 : 0),
      totalFiles: acc.totalFiles + 1
    }), this.getEmptyStats());
  },

  getEmptyStats() {
    return {
      totalAbstracts: 0,
      totalEvents: 0,
      annotatedEvents: 0,
      completedFiles: 0,
      totalFiles: 0
    };
  }
};