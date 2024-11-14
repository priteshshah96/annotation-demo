// src/services/fileApi.js
import { api } from '../lib/api';

const formatExportData = (file, annotations) => {
  return {
    file_name: file.name,
    export_date: new Date().toISOString(),
    abstracts: file.abstracts.map((abstract, abstractIndex) => ({
      paper_code: abstract.paper_code,
      abstract: abstract.abstract,
      sentences: abstract.sentences.map((sentence, sentenceIndex) => {
        const sentenceKey = `${abstractIndex}-${sentenceIndex}--1`;
        
        return {
          sentence_code: sentence.sentence_code,
          text: sentence.text,
          sentence_type: annotations[sentenceKey] || null,
          scientific_entities: sentence.scientific_entities.map((entity, entityIndex) => {
            const entityKey = `${abstractIndex}-${sentenceIndex}-${entityIndex}`;
            
            return {
              entity: entity.entity,
              type: annotations[entityKey] || null
            };
          })
        };
      })
    }))
  };
};

export const fileApi = {
  // Get all files for the current user
  async getFiles() {
    try {
      const response = await api.files.getAll();
      return response;
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },

  // Upload a new file
  async uploadFile(fileData) {
    try {
      console.log('Starting file upload:', {
        fileName: fileData.name,
        contentLength: JSON.stringify(fileData.content).length
      });
      
      const response = await api.files.upload(fileData);
      
      console.log('Upload successful:', {
        fileId: response.file?._id,
        fileName: response.file?.name
      });
      
      return response;
    } catch (error) {
      console.error('Upload error:', {
        message: error.message,
        status: error.status,
        details: error.details
      });
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
      const exportData = formatExportData(response.file, response.file.annotations || {});
      
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
      
      // Calculate entity totals and progress separately
      const stats = files.reduce((acc, file) => {
        // Count total entities
        const totalEntitiesInFile = (file.abstracts || []).reduce((abstractTotal, abstract) => 
          abstractTotal + (abstract.sentences || []).reduce((sentenceTotal, sentence) => 
            sentenceTotal + (sentence.scientific_entities || []).length, 0), 0);

        // Calculate annotated entities based on completion status
        const annotatedEntitiesInFile = file.progress === 100 ? totalEntitiesInFile : 
          Math.floor((file.progress || 0) * totalEntitiesInFile / 100);

        return {
          totalAnnotations: acc.totalAnnotations + Math.floor((file.progress || 0) * (file.totalSteps || 0) / 100),
          completedFiles: acc.completedFiles + (file.progress === 100 ? 1 : 0),
          totalFiles: acc.totalFiles + 1,
          totalSentences: acc.totalSentences + (file.abstracts || []).reduce((abstractTotal, abstract) => 
            abstractTotal + (abstract.sentences || []).length, 0),
          totalEntities: acc.totalEntities + totalEntitiesInFile,
          targetAnnotations: acc.targetAnnotations + (file.totalSteps || 0),
          annotatedEntities: acc.annotatedEntities + annotatedEntitiesInFile
        };
      }, {
        totalAnnotations: 0,
        completedFiles: 0,
        totalFiles: 0,
        totalSentences: 0,
        totalEntities: 0,
        targetAnnotations: 0,
        annotatedEntities: 0
      });

      return stats;
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        totalAnnotations: 0,
        completedFiles: 0,
        totalFiles: 0,
        totalSentences: 0,
        totalEntities: 0,
        targetAnnotations: 0,
        annotatedEntities: 0
      };
    }
  }
};