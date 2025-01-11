import { api } from '../lib/api';

export const fileApi = {
  async uploadFile(fileData) {
    try {
      // Debugging: Log the fileData object
      console.log('fileData:', fileData);

      // Check if papers property exists
      if (!fileData.papers) {
        throw new Error('The "papers" property is missing in fileData.');
      }

      // Calculate metadata required for StatsPanel
      const totalEvents = fileData.papers.reduce((sum, paper) => 
        sum + (paper.events?.length || 0), 0);

      const uploadData = {
        name: fileData.name,
        papers: fileData.papers,
        userId: fileData.userId,
        metadata: {
          totalPapers: fileData.papers.length,
          totalEvents,
          totalFields: totalEvents * 14 // Assuming 14 fields per event
        },
        progress: 0
      };

      console.log('Upload data structure:', JSON.stringify({
        name: uploadData.name,
        paperCount: uploadData.papers.length,
        firstPaper: uploadData.papers[0] ? {
          paper_code: uploadData.papers[0].paper_code,
          hasEvents: !!uploadData.papers[0].events
        } : null
      }));

      return await api.files.upload(uploadData);
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  async getFiles() {
    try {
      const response = await api.files.getAll();
      
      // Process files to include stats needed by StatsPanel
      const files = response.files?.map(file => ({
        ...file,
        totalPapers: file.papers?.length || 0,
        totalEvents: file.papers?.reduce((sum, paper) => 
          sum + (paper.events?.length || 0), 0) || 0,
        totalFields: file.papers?.reduce((sum, paper) => 
          sum + ((paper.events?.length || 0) * 14), 0) || 0,
        progress: file.progress || 0
      })) || [];

      return {
        files,
        totalFiles: response.totalFiles
      };
    } catch (error) {
      console.error('Error fetching files:', error);
      throw new Error(`Failed to fetch files: ${error.message}`);
    }
  },

  async getFile(fileId) {
    try {
      const response = await api.files.get(fileId);
      if (!response?.file) return null;

      // Add stats for single file view
      const totalEvents = response.file.papers?.reduce((sum, paper) => 
        sum + (paper.events?.length || 0), 0) || 0;

      return {
        ...response.file,
        totalEvents,
        totalFields: totalEvents * 14,
        progress: response.file.progress || 0
      };
    } catch (error) {
      console.error('Error fetching file:', error);
      throw new Error(`Failed to fetch file: ${error.message}`);
    }
  },

  async deleteFile(fileId) {
    try {
      return await api.files.delete(fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
};