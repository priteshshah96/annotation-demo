import { api } from '../lib/api';

// Utility function to format event data
const formatEvent = (event = {}) => {
  return {
    'Background/Introduction': event['Background/Introduction'] || '',
    'Methods/Approach': event['Methods/Approach'] || '',
    'Results/Findings': event['Results/Findings'] || '',
    'Conclusions/Implications': event['Conclusions/Implications'] || '',
    Text: event.Text || '',
    'Main Action': event['Main Action'] || '',
    Arguments: {
      Agent: event.Arguments?.Agent || '',
      Object: {
        'Base Object': event.Arguments?.Object?.['Base Object'] || '',
        'Base Modifier': event.Arguments?.Object?.['Base Modifier'] || '',
        'Attached Object': event.Arguments?.Object?.['Attached Object'] || '',
        'Attached Modifier': event.Arguments?.Object?.['Attached Modifier'] || ''
      },
      Context: event.Arguments?.Context || '',
      Purpose: event.Arguments?.Purpose || '',
      Method: event.Arguments?.Method || '',
      Results: event.Arguments?.Results || '',
      Analysis: event.Arguments?.Analysis || '',
      Challenge: event.Arguments?.Challenge || '',
      Ethical: event.Arguments?.Ethical || '',
      Implications: event.Arguments?.Implications || '',
      Contradictions: event.Arguments?.Contradictions || ''
    }
  };
};

// Utility function to calculate total steps
const calculateTotalSteps = (content) => {
  return content.reduce((totalSteps, abstract) => {
    return totalSteps + (abstract.events?.reduce((eventSteps, event) => {
      const eventTypes = ['Background/Introduction', 'Methods/Approach', 'Results/Findings', 'Conclusions/Implications'];
      const argumentFields = ['Agent', 'Context', 'Purpose', 'Method', 'Results', 'Analysis', 'Challenge', 'Ethical', 'Implications', 'Contradictions'];
      const objectFields = ['Base Object', 'Base Modifier', 'Attached Object', 'Attached Modifier'];

      // Count non-empty event types
      eventSteps += eventTypes.filter(type => event[type]).length;

      // Count Main Action if present
      if (event['Main Action']) eventSteps++;

      // Count non-empty argument fields
      eventSteps += argumentFields.filter(field => event.Arguments?.[field]).length;

      // Count non-empty object fields
      eventSteps += objectFields.filter(field => event.Arguments?.Object?.[field]).length;

      return eventSteps;
    }, 0) || 0);
  }, 0);
};

// Utility function to format export data
const formatExportData = (file) => ({
  file_name: file.name,
  export_date: new Date().toISOString(),
  abstracts: file.abstracts.map(abstract => ({
    paper_code: abstract.paper_code,
    abstract: abstract.abstract,
    events: abstract.events.map(event => formatEvent(event))
  }))
});

export const fileApi = {
  async uploadFile(fileData) {
    try {
      // Validate input data
      if (!fileData.content || !Array.isArray(fileData.content)) {
        throw new Error('Invalid file content: expected an array of abstracts');
      }

      // Process each abstract
      const formattedContent = fileData.content.map(abstract => ({
        paper_code: abstract.paper_code,
        abstract: abstract.abstract,
        events: (abstract.events || []).map(event => formatEvent(event))
      }));

      // Calculate total steps
      const totalSteps = calculateTotalSteps(formattedContent);

      // Prepare upload data
      const uploadData = {
        name: fileData.name,
        content: formattedContent,
        userId: fileData.userId,
        metadata: {
          totalAbstracts: formattedContent.length,
          totalEvents: formattedContent.reduce((sum, abstract) => sum + (abstract.events?.length || 0), 0)
        },
        totalSteps
      };

      // Make API request
      const response = await api.files.upload(uploadData);
      return response;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  },

  async getFiles() {
    try {
      const response = await api.files.getAll();
      if (!response.files) {
        throw new Error('Invalid response: files not found');
      }

      // Calculate progress for each file
      response.files = response.files.map(file => {
        const totalAbstracts = file.abstracts?.length || 0;
        const totalEvents = file.abstracts?.reduce((sum, abstract) => sum + (abstract.events?.length || 0), 0) || 0;
        const annotatedEvents = file.abstracts?.reduce((sum, abstract) => {
          return sum + (abstract.events?.filter(event => event.isAnnotated).length || 0);
        }, 0) || 0;

        const progress = totalEvents > 0 ? Math.round((annotatedEvents / totalEvents) * 100) : 0;

        return {
          _id: file._id,
          name: file.name,
          totalAbstracts,
          totalEvents,
          progress,
          uploadDate: file.uploadDate,
          metadata: file.metadata || {}
        };
      });

      return response;
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },

  async deleteFile(fileId) {
    try {
      const response = await api.files.delete(fileId);
      return response;
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

      // Format the export data
      const exportData = formatExportData(response.file);
      return { success: true, file: exportData };
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

      const exportData = response.file;
      const fileName = exportData.file_name.replace('.json', '_annotated.json');
      return { data: exportData, fileName };
    } catch (error) {
      console.error('Error exporting file:', error);
      throw error;
    }
  },

  async getUserStats() {
    try {
      const response = await this.getFiles();
      const files = response.files || [];

      const stats = files.reduce((acc, file) => {
        const totalAbstracts = file.totalAbstracts || 0;
        const totalEvents = file.totalEvents || 0;
        const annotatedEvents = Math.floor((file.progress || 0) * totalEvents / 100);

        return {
          totalAbstracts: acc.totalAbstracts + totalAbstracts,
          totalEvents: acc.totalEvents + totalEvents,
          annotatedEvents: acc.annotatedEvents + annotatedEvents,
          completedFiles: acc.completedFiles + (file.progress === 100 ? 1 : 0),
          totalFiles: acc.totalFiles + 1
        };
      }, {
        totalAbstracts: 0,
        totalEvents: 0,
        annotatedEvents: 0,
        completedFiles: 0,
        totalFiles: 0
      });

      return stats;
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        totalAbstracts: 0,
        totalEvents: 0,
        annotatedEvents: 0,
        completedFiles: 0,
        totalFiles: 0
      };
    }
  }
};