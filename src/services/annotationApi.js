// services/annotationApi.js
import { api } from '../lib/api';
import { AnnotationTypes } from '../models/Annotation';

// Helper to normalize field paths for consistency
const normalizeFieldPath = (fieldPath) => {
  if (fieldPath.startsWith('Arguments.Object.')) {
    return fieldPath;
  } else if (fieldPath.startsWith('Object.')) {
    return `Arguments.${fieldPath}`;
  }
  return fieldPath;
};

class AnnotationApi {
  async getFileWithAnnotations(fileId) {
    try {
      const fileResponse = await api.files.get(fileId);
      if (!fileResponse.success) {
        throw new Error('File not found');
      }
  
      const annotationsResponse = await api.annotations.get(fileId);
  
      const papers = fileResponse.papers.map(paper => ({
        ...paper,
        events: paper.events.map(event => {
          // Find event type
          const eventType = AnnotationTypes.EVENT_TYPE.find(
            type => event[type] !== undefined
          );
  
          // Initialize clean event structure
          return {
            ...event,
            [eventType]: event[eventType] || '',
            'Main Action': '',
            Arguments: {
              Agent: [],
              Object: {
                'Base Object': [],
                'Base Modifier': [],
                'Attached Object': [],
                'Attached Modifier': []
              },
              Context: [],
              Purpose: [],
              Method: [],
              Results: [],
              Analysis: [],
              Challenge: [],
              Ethical: [],
              Implications: [],
              Contradictions: []
            }
          };
        })
      }));
  
      // Apply annotations if they exist
      if (annotationsResponse?.annotations) {
        annotationsResponse.annotations.forEach(annotation => {
          const { paperIndex, eventIndex, fieldPath, answer } = annotation;
          if (!papers[paperIndex]?.events[eventIndex]) return;
  
          const normalizedPath = normalizeFieldPath(fieldPath);
          
          if (normalizedPath === 'Main Action') {
            papers[paperIndex].events[eventIndex]['Main Action'] = answer || '';
          } else if (normalizedPath.startsWith('Arguments.')) {
            const [, category, ...rest] = normalizedPath.split('.');
            if (rest.length > 0) {
              // Handle Object annotations
              const objectField = rest.join('.');
              papers[paperIndex].events[eventIndex].Arguments.Object[objectField] = 
                Array.isArray(answer) ? answer : [];
            } else {
              // Handle regular arguments
              papers[paperIndex].events[eventIndex].Arguments[category] = 
                Array.isArray(answer) ? answer : [];
            }
          } else {
            // Handle event type annotations
            papers[paperIndex].events[eventIndex][normalizedPath] = answer || '';
          }
        });
      }
  
      return {
        ...fileResponse,
        papers
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async saveAnnotation(annotation) {
    const { 
      fileId, 
      paperIndex, 
      eventIndex, 
      fieldPath, 
      answer,
      isDelete = false
    } = annotation;
  
    if (!fileId || paperIndex === undefined || eventIndex === undefined || !fieldPath) {
      throw new Error('Missing required fields');
    }
  
    try {
      const normalizedPath = normalizeFieldPath(fieldPath);
      let processedAnswer;

      if (isDelete) {
        // Handle deletion
        processedAnswer = normalizedPath.startsWith('Arguments.') ? [] : '';
      } else {
        // Process answer based on field type
        if (normalizedPath === 'Main Action' || AnnotationTypes.EVENT_TYPE.includes(normalizedPath)) {
          processedAnswer = String(answer || '').trim();
        } else if (normalizedPath.startsWith('Arguments.')) {
          processedAnswer = Array.isArray(answer) ? answer : [];
        }
      }

      const payload = {
        fileId,
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath: normalizedPath,
        answer: processedAnswer
      };
  
      const response = await api.annotations.save(payload);
      return response.annotation;
    } catch (error) {
      // Handle specific validation errors from the model
      if (error.name === 'ValidationError') {
        throw new Error(Object.values(error.errors)[0].message);
      }
      throw this.formatError(error);
    }
  }

  async syncAnnotations(fileId, annotations) {
    if (!fileId || !Array.isArray(annotations) || annotations.length === 0) {
      throw new Error('Invalid sync parameters');
    }

    try {
      const processedAnnotations = annotations.map(ann => ({
        ...ann,
        fieldPath: normalizeFieldPath(ann.fieldPath),
        answer: ann.answer
      }));

      return await api.annotations.sync(fileId, { 
        annotations: processedAnnotations 
      });
    } catch (error) {
      throw this.formatError(error);
    }
  }

  formatError(error) {
    if (error.name === 'ValidationError') {
      return {
        message: Object.values(error.errors)[0].message,
        status: 400,
        details: error.errors
      };
    }
    
    return {
      message: error.message || 'An error occurred',
      status: error.status || 500,
      details: error.details || null
    };
  }
}

export const annotationApi = new AnnotationApi();