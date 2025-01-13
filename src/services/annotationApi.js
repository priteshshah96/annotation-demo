// services/annotationApi.js
import { api } from '../lib/api';
import { AnnotationTypes } from '../models/Annotation';

const FIELD_TYPES = {
  EVENT_TYPE: 'EVENT_TYPE',
  MAIN_ACTION: 'MAIN_ACTION',
  TEXT: 'TEXT',
  OBJECT: 'OBJECT',
  ARGUMENT: 'ARGUMENT'
};

const ANNOTATION_FIELDS = {
  EVENT_TYPES: AnnotationTypes.EVENT_TYPE,
  MAIN_ACTION: AnnotationTypes.MAIN_ACTION,
  ARGUMENTS: AnnotationTypes.ARGUMENT_FIELDS,
  OBJECT: AnnotationTypes.ARGUMENT_FIELDS.OBJECT
};

class AnnotationApi {
  determineFieldType(field) {
    if (!field) throw new Error('Field is required');

    if (AnnotationTypes.EVENT_TYPES?.includes(field)) {
      return FIELD_TYPES.EVENT_TYPE;
    }
    if (field === AnnotationTypes.MAIN_ACTION) {
      return FIELD_TYPES.MAIN_ACTION;
    }
    if (field === 'Text') {
      return FIELD_TYPES.TEXT;
    }
    if (field.startsWith('Object.')) {
      return FIELD_TYPES.OBJECT;
    }
    if (Object.values(AnnotationTypes.ARGUMENT_FIELDS).includes(field)) {
      return FIELD_TYPES.ARGUMENT;
    }
    throw new Error(`Invalid field type: ${field}`);
  }

  async getFileWithAnnotations(fileId, userId) {
    if (!fileId) throw new Error('FileId is required');
    if (!userId) throw new Error('UserId is required');

    try {
      // Fetch file data through API
      const fileResponse = await api.files.get(fileId);
      console.log('File Response:', fileResponse);
      
      if (!fileResponse.success || !fileResponse.file) {
        throw new Error('File not found');
      }

      const file = fileResponse.file;

      // Initialize empty annotations for each event
      const papers = file.papers.map(paper => ({
        ...paper,
        events: (paper.events || []).map(event => ({
          ...event,
          Arguments: {
            Agent: '',
            Object: {
              'Base Object': '',
              'Base Modifier': '',
              'Attached Object': '',
              'Attached Modifier': ''
            },
            Context: '',
            Purpose: '',
            Method: '',
            Results: '',
            Analysis: '',
            Challenge: '',
            Ethical: '',
            Implications: '',
            Contradictions: ''
          },
          'Background/Introduction': '',
          'Methods/Approach': '',
          'Results/Findings': '',
          'Conclusions/Implications': '',
          'Main Action': '',
          Text: event.Text || ''
        }))
      }));

      try {
        const annotationsResponse = await api.annotations.get(fileId);
        console.log('Annotations Response:', annotationsResponse);

        if (annotationsResponse && Array.isArray(annotationsResponse)) {
          annotationsResponse.forEach(annotation => {
            const { paperIndex, eventIndex, fieldPath, answer } = annotation;
            if (papers[paperIndex]?.events[eventIndex]) {
              if (fieldPath.startsWith('Object.')) {
                const objectField = fieldPath.replace('Object.', '');
                papers[paperIndex].events[eventIndex].Arguments.Object[objectField] = answer;
              } else if (fieldPath.startsWith('Arguments.')) {
                const argField = fieldPath.replace('Arguments.', '');
                papers[paperIndex].events[eventIndex].Arguments[argField] = answer;
              } else {
                papers[paperIndex].events[eventIndex][fieldPath] = answer;
              }
            }
          });
        }
      } catch (error) {
        console.warn('No existing annotations found:', error);
      }

      return {
        ...file,
        papers
      };
    } catch (error) {
      console.error('Error fetching file with annotations:', error);
      throw this.formatError(error);
    }
  }

  async saveAnnotation(annotation) {
    console.log('Starting saveAnnotation with:', annotation);
  
    // Debugging: Log the annotation object before destructuring
    console.log('Annotation object:', annotation);
  
    // Destructure the annotation object with the correct property name
    const { fileId, paperIndex, eventIndex, fieldPath, answer: value, userId } = annotation;
  
    // Debugging: Log the value before validation
    console.log('Value before validation:', value);
  
    // Validate value
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid value for annotation. Value must be a non-empty string.');
    }
  
    // Validate and normalize indices
    const normalizedIndices = {
      paperIndex: paperIndex !== undefined ? Number(paperIndex) : undefined,
      eventIndex: eventIndex !== undefined ? Number(eventIndex) : undefined
    };
  
    // Validate indices are valid numbers
    if (isNaN(normalizedIndices.paperIndex) || isNaN(normalizedIndices.eventIndex)) {
      throw new Error('Indices must be valid numbers');
    }
  
    // Validate indices are non-negative
    if (normalizedIndices.paperIndex < 0 || normalizedIndices.eventIndex < 0) {
      throw new Error('Indices must be non-negative');
    }
  
    // Validate required parameters
    const requiredParams = {
      fileId,
      paperIndex: normalizedIndices.paperIndex,
      eventIndex: normalizedIndices.eventIndex,
      fieldPath,
      userId
    };
  
    const missingParams = Object.entries(requiredParams)
      .filter(([_, value]) => value === undefined || value === null)
      .map(([key]) => key);
  
    if (missingParams.length > 0) {
      const errorMsg = `Missing required parameters: ${missingParams.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  
    try {
      // Normalize the fieldPath based on the type
      let normalizedFieldPath = fieldPath;
  
      if (fieldPath.startsWith('Arguments.Object.')) {
        // Convert 'Arguments.Object.Base_Object' to 'Object.Base Object'
        normalizedFieldPath = fieldPath
          .replace('Arguments.Object.', 'Object.')
          .replace(/_/g, ' ');
      } else if (fieldPath.startsWith('Arguments.')) {
        // Keep Arguments prefix but normalize field name
        normalizedFieldPath = fieldPath.replace(/_/g, ' ');
      } else if (fieldPath === 'Main Action') {
        normalizedFieldPath = fieldPath;
      } else {
        console.warn('Unexpected fieldPath format:', fieldPath);
      }
  
      console.log('Normalized field path:', normalizedFieldPath);
  
      // Prepare payload
      const payload = {
        fileId,
        paperIndex: normalizedIndices.paperIndex,
        eventIndex: normalizedIndices.eventIndex,
        fieldPath: normalizedFieldPath,
        answer: value.trim() // Ensure the value is trimmed and not empty
      };
  
      console.log('Sending annotation payload:', payload);
  
      // Send payload to server
      const response = await api.annotations.save(payload);
      console.log('Save annotation response:', response);
  
      if (!response.success) {
        throw new Error(response.error || 'Failed to save annotation');
      }
  
      return response.annotation;
    } catch (error) {
      console.error('Error in saveAnnotation:', error);
      throw this.formatError(error);
    }
  }

  async syncAnnotations(fileId, annotations) {
    if (!fileId || !Array.isArray(annotations)) {
      throw new Error('Invalid parameters for sync');
    }

    try {
      const response = await api.annotations.sync(fileId, {
        annotations: annotations.map(ann => ({
          fileId,
          paperIndex: ann.paperIndex,
          eventIndex: ann.eventIndex,
          fieldPath: ann.fieldPath,
          answer: ann.answer,
          timestamp: ann.timestamp || new Date().toISOString()
        }))
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to sync annotations');
      }

      return response;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  formatError(error) {
    const formattedError = {
      message: error.message || 'An error occurred',
      status: error.status || 500,
      details: error.details || null
    };

    if (error.response?.data) {
      formattedError.message = error.response.data.error || formattedError.message;
      formattedError.details = error.response.data.details || formattedError.details;
      formattedError.status = error.response.status || formattedError.status;
    }

    return formattedError;
  }
}

const annotationApi = new AnnotationApi();

export {
  annotationApi,
  FIELD_TYPES,
  ANNOTATION_FIELDS
};