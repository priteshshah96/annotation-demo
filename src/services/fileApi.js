import { api } from '../lib/api';

const formatEvent = (event = {}) => {
  console.log('Formatting event:', event);
  
  const formatted = {
    'Background/Introduction': event['Background/Introduction'] || '',
    'Methods/Approach': event['Methods/Approach'] || '',
    'Results/Findings': event['Results/Findings'] || '',
    'Conclusions/Implications': event['Conclusions/Implications'] || '',
    'Text': event.Text || '',
    'Main Action': event['Main Action'] || '',
    'Arguments': {
      'Agent': event.Arguments?.Agent || '',
      'Context': event.Arguments?.Context || '',
      'Purpose': event.Arguments?.Purpose || '',
      'Method': event.Arguments?.Method || '',
      'Results': event.Arguments?.Results || '',
      'Analysis': event.Arguments?.Analysis || '',
      'Challenge': event.Arguments?.Challenge || '',
      'Ethical': event.Arguments?.Ethical || '',
      'Implications': event.Arguments?.Implications || '',
      'Contradictions': event.Arguments?.Contradictions || '',
      'Object': {
        'Base Object': event.Arguments?.Object?.['Base Object'] || '',
        'Base Modifier': event.Arguments?.Object?.['Base Modifier'] || '',
        'Attached Object': event.Arguments?.Object?.['Attached Object'] || '',
        'Attached Modifier': event.Arguments?.Object?.['Attached Modifier'] || ''
      }
    }
  };

  console.log('Formatted event:', formatted);
  return formatted;
};

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
  // Add upload file method
  async uploadFile(fileData) {
    try {
      // Log the incoming data structure
      console.log('Raw incoming data structure:', {
        name: fileData.name,
        contentSample: fileData.content[0] ? Object.keys(fileData.content[0]) : []
      });
  
      // Format content for upload
      const formattedContent = fileData.content.map(abstract => {
        console.log('Processing abstract:', {
          paper_code: abstract.paper_code,
          hasEvents: Boolean(abstract.events),
          eventCount: abstract.events?.length
        });
  
        return {
          paper_code: abstract.paper_code,
          abstract: abstract.abstract,
          events: abstract.events.map(event => {
            console.log('Processing event:', {
              eventFields: Object.keys(event)
            });
            
            return {
              'Background/Introduction': event['Background/Introduction'] || '',
              'Methods/Approach': event['Methods/Approach'] || '',
              'Results/Findings': event['Results/Findings'] || '',
              'Conclusions/Implications': event['Conclusions/Implications'] || '',
              'Text': event.Text || '',
              'Main Action': event['Main Action'] || '',
              'Arguments': {
                'Agent': event.Arguments?.Agent || '',
                'Context': event.Arguments?.Context || '',
                'Purpose': event.Arguments?.Purpose || '',
                'Method': event.Arguments?.Method || '',
                'Results': event.Arguments?.Results || '',
                'Analysis': event.Arguments?.Analysis || '',
                'Challenge': event.Arguments?.Challenge || '',
                'Ethical': event.Arguments?.Ethical || '',
                'Implications': event.Arguments?.Implications || '',
                'Contradictions': event.Arguments?.Contradictions || '',
                'Object': {
                  'Base Object': event.Arguments?.Object?.['Base Object'] || '',
                  'Base Modifier': event.Arguments?.Object?.['Base Modifier'] || '',
                  'Attached Object': event.Arguments?.Object?.['Attached Object'] || '',
                  'Attached Modifier': event.Arguments?.Object?.['Attached Modifier'] || ''
                }
              }
            };
          })
        };
      });
  
      // Log the formatted structure before upload
      console.log('Formatted content before upload:', {
        abstractCount: formattedContent.length,
        sampleAbstract: formattedContent[0] ? {
          fields: Object.keys(formattedContent[0]),
          hasEvents: Boolean(formattedContent[0].events),
          eventCount: formattedContent[0].events?.length
        } : null
      });
  
      const uploadData = {
        name: fileData.name,
        content: formattedContent,
        metadata: {
          totalEvents: formattedContent.reduce((sum, abstract) => 
            sum + (abstract.events?.length || 0), 0),
        }
      };
  
      // Log final upload data
      console.log('Final upload data structure:', {
        name: uploadData.name,
        contentLength: uploadData.content.length,
        firstAbstractKeys: uploadData.content[0] ? Object.keys(uploadData.content[0]) : []
      });
  
      const response = await api.files.upload(uploadData);
      console.log('Upload response:', response);
  
      return response;
    } catch (error) {
      console.error('Error uploading file:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  },

  async getFiles() {
    try {
      const response = await api.files.getAll();
      console.log('Raw server response:', response);
      
      if (response.files) {
        response.files = response.files.map(file => {
          let totalSteps = 0;
          
          const abstracts = file.abstracts?.map(abstract => {
            const events = abstract.events || [];
            
            // Calculate steps for each event
            events.forEach(event => {
              // Count event type fields
              ['Background/Introduction', 'Methods/Approach', 
               'Results/Findings', 'Conclusions/Implications'].forEach(type => {
                if (event[type]) totalSteps++;
              });
              
              // Count Main Action
              if (event['Main Action']) totalSteps++;
              
              // Count Arguments fields
              if (event.Arguments) {
                if (event.Arguments.Agent) totalSteps++;
                if (event.Arguments.Context) totalSteps++;
                if (event.Arguments.Purpose) totalSteps++;
                if (event.Arguments.Method) totalSteps++;
                if (event.Arguments.Results) totalSteps++;
                if (event.Arguments.Analysis) totalSteps++;
                if (event.Arguments.Challenge) totalSteps++;
                if (event.Arguments.Ethical) totalSteps++;
                if (event.Arguments.Implications) totalSteps++;
                if (event.Arguments.Contradictions) totalSteps++;
                
                // Count Object fields
                if (event.Arguments.Object) {
                  if (event.Arguments.Object['Base Object']) totalSteps++;
                  if (event.Arguments.Object['Base Modifier']) totalSteps++;
                  if (event.Arguments.Object['Attached Object']) totalSteps++;
                  if (event.Arguments.Object['Attached Modifier']) totalSteps++;
                }
              }
            });
            
            return {
              paper_code: abstract.paper_code,
              abstract: abstract.abstract,
              events
            };
          }) || [];
  
          return {
            _id: file._id,
            name: file.name,
            totalSteps,
            progress: file.progress || 0,
            uploadDate: file.uploadDate,
            abstracts
          };
        });
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching files:', error);
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
        // Calculate events and their fields
        const totalEvents = file.abstracts?.reduce((sum, abstract) => 
          sum + (abstract.events?.length || 0), 0) || 0;
        
        const totalFields = totalEvents * 14;
        const completedFields = Math.floor((file.progress || 0) * totalFields / 100);
        
        return {
          totalEvents: acc.totalEvents + totalEvents,
          totalFields: acc.totalFields + totalFields,
          completedFields: acc.completedFields + completedFields,
          completedFiles: acc.completedFiles + (file.progress === 100 ? 1 : 0),
          totalFiles: acc.totalFiles + 1
        };
      }, {
        totalEvents: 0,
        totalFields: 0,
        completedFields: 0,
        completedFiles: 0,
        totalFiles: 0
      });

      return stats;
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        totalEvents: 0,
        totalFields: 0,
        completedFields: 0,
        completedFiles: 0,
        totalFiles: 0
      };
    }
  }
};