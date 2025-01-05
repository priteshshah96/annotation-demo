// src/services/fileApi.js
import { api } from '../lib/api';

const formatExportData = (file) => {
  return {
    file_name: file.name,
    export_date: new Date().toISOString(),
    abstracts: file.abstracts.map(abstract => ({
      paper_code: abstract.paper_code,
      abstract: abstract.abstract,
      events: abstract.events.map(event => ({
        type: event.type,
        Text: event.Text,
        Main_Action: event.Main_Action || '',
        Arguments: {
          Agent: event.Arguments.Agent || '',
          Object: {
            Base_Object: event.Arguments.Object?.Base_Object || '',
            Base_Modifier: event.Arguments.Object?.Base_Modifier || '',
            Attached_Object: event.Arguments.Object?.Attached_Object || '',
            Attached_Modifier: event.Arguments.Object?.Attached_Modifier || ''
          },
          Context: event.Arguments.Context || '',
          Purpose: event.Arguments.Purpose || '',
          Method: event.Arguments.Method || '',
          Results: event.Arguments.Results || '',
          Analysis: event.Arguments.Analysis || '',
          Challenge: event.Arguments.Challenge || '',
          Ethical: event.Arguments.Ethical || '',
          Implications: event.Arguments.Implications || '',
          Contradictions: event.Arguments.Contradictions || ''
        }
      }))
    }))
  };
};

export const fileApi = {
  // Get all files for the current user
  async getFiles() {
    try {
      const response = await api.files.getAll();
      
      // Format files for display
      if (response.files) {
        response.files = response.files.map(file => ({
          _id: file._id,
          name: file.name,
          totalSteps: file.totalSteps,
          progress: file.progress,
          uploadDate: file.uploadDate,
          abstractCount: file.abstracts?.length || 0,
          eventCount: file.abstracts?.reduce((sum, abstract) => 
            sum + (abstract.events?.length || 0), 0) || 0
        }));
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },

  // Upload a new file
  async uploadFile(fileData) {
    try {
      if (!Array.isArray(fileData.content)) {
        throw new Error('File content must be an array of abstracts');
      }

      // Validate and format each abstract
      const formattedContent = fileData.content.map(abstract => ({
        paper_code: abstract.paper_code,
        abstract: abstract.abstract,
        events: (abstract.events || []).map(event => ({
          type: event.type || 'Background/Introduction', // Default type if not specified
          Text: event.Text,
          Main_Action: event.Main_Action || '',
          Arguments: {
            Agent: event.Arguments?.Agent || '',
            Object: {
              Base_Object: event.Arguments?.Object?.Base_Object || '',
              Base_Modifier: event.Arguments?.Object?.Base_Modifier || '',
              Attached_Object: event.Arguments?.Object?.Attached_Object || '',
              Attached_Modifier: event.Arguments?.Object?.Attached_Modifier || ''
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
        }))
      }));

      const response = await api.files.upload({
        name: fileData.name,
        content: formattedContent
      });

      return response;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  // Delete a file
  async deleteFile(fileId) {
    try {
      const response = await api.files.delete(fileId);
      return response;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  // Get single file by ID
  async getFile(fileId) {
    try {
      const response = await api.files.get(fileId);
      if (!response?.file) {
        throw new Error('File not found');
      }

      // Format the export data
      const exportData = formatExportData(response.file);
      
      return {
        success: true,
        file: exportData
      };
    } catch (error) {
      console.error('Error fetching file:', error);
      throw error;
    }
  },

  // Export file with annotations
  async exportFile(fileId) {
    try {
      const response = await this.getFile(fileId);
      if (!response?.success || !response?.file) {
        throw new Error('Failed to export file');
      }

      const exportData = response.file;
      const fileName = exportData.file_name.replace('.json', '_annotated.json');

      return {
        data: exportData,
        fileName
      };
    } catch (error) {
      console.error('Error exporting file:', error);
      throw error;
    }
  },

  // Get user statistics
  async getUserStats() {
    try {
      const response = await this.getFiles();
      const files = response.files || [];
      
      const stats = files.reduce((acc, file) => {
        // Calculate events and annotations
        const eventCount = file.eventCount || 0;
        const completedSteps = Math.floor((file.progress || 0) * file.totalSteps / 100);
        
        // Update accumulator
        return {
          totalAnnotations: acc.totalAnnotations + completedSteps,
          completedFiles: acc.completedFiles + (file.progress === 100 ? 1 : 0),
          totalFiles: acc.totalFiles + 1,
          totalEvents: acc.totalEvents + eventCount,
          targetAnnotations: acc.targetAnnotations + (file.totalSteps || 0),
          pendingAnnotations: acc.pendingAnnotations + (file.totalSteps - completedSteps)
        };
      }, {
        totalAnnotations: 0,
        completedFiles: 0,
        totalFiles: 0,
        totalEvents: 0,
        targetAnnotations: 0,
        pendingAnnotations: 0
      });

      return stats;
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        totalAnnotations: 0,
        completedFiles: 0,
        totalFiles: 0,
        totalEvents: 0,
        targetAnnotations: 0,
        pendingAnnotations: 0
      };
    }
  }
};