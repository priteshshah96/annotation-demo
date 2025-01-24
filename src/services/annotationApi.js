// services/annotationApi.js
import { api } from '../lib/api';
import { AnnotationTypes } from '../models/Annotation';

const FIELD_TYPES = {
  EVENT_TYPE: 'EVENT_TYPE',
  MAIN_ACTION: 'MAIN_ACTION',
  ARGUMENT: 'ARGUMENT',
  OBJECT: 'OBJECT'
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

    if (AnnotationTypes.EVENT_TYPE.includes(field)) {
      return FIELD_TYPES.EVENT_TYPE;
    }
    if (field === AnnotationTypes.MAIN_ACTION) {
      return FIELD_TYPES.MAIN_ACTION;
    }
    if (field.startsWith('Object.')) {
      return FIELD_TYPES.OBJECT;
    }
    if (Object.values(AnnotationTypes.ARGUMENT_FIELDS).includes(field)) {
      return FIELD_TYPES.ARGUMENT;
    }
    throw new Error(`Invalid field type: ${field}`);
  }

  async getFileWithAnnotations(fileId) {
    try {
      const fileResponse = await api.files.get(fileId);
      if (!fileResponse.success) {
        throw new Error('File not found');
      }
  
      const annotationsResponse = await api.annotations.get(fileId);
      const papers = fileResponse.papers.map(paper => ({
        ...paper,
        events: paper.events.map(event => ({
          ...event,
          ArgumentPositions: {},  // Add this to store span positions
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
          },
          'Main Action': null
        }))
      }));

      // Apply annotations to papers
      if (annotationsResponse?.annotations) {
        annotationsResponse.annotations.forEach(annotation => {
          const { paperIndex, eventIndex, fieldPath, answer } = annotation;
          if (!papers[paperIndex]?.events[eventIndex]) return;

          const event = papers[paperIndex].events[eventIndex];
          
          // Get the text content from the answer
          const textContent = answer?.text || answer;
          
          // Get the span information
          const span = answer?.span || null;

          // Store the span position if it exists
          if (span) {
            event.ArgumentPositions[fieldPath] = event.ArgumentPositions[fieldPath] || [];
            event.ArgumentPositions[fieldPath].push(span);
          }

          if (fieldPath === 'Main Action') {
            event['Main Action'] = textContent;
          } 
          else if (fieldPath.startsWith('Arguments.Object.')) {
            const objectField = fieldPath.replace('Arguments.Object.', '');
            const currentValue = event.Arguments.Object[objectField];
            
            if (currentValue && currentValue.length > 0) {
              if (Array.isArray(currentValue)) {
                event.Arguments.Object[objectField].push(textContent);
              } else {
                event.Arguments.Object[objectField] = [currentValue, textContent];
              }
            } else {
              event.Arguments.Object[objectField] = textContent;
            }
          } 
          else if (fieldPath.startsWith('Arguments.')) {
            const argField = fieldPath.replace('Arguments.', '');
            const currentValue = event.Arguments[argField];
            
            if (currentValue && currentValue.length > 0) {
              if (Array.isArray(currentValue)) {
                event.Arguments[argField].push(textContent);
              } else {
                event.Arguments[argField] = [currentValue, textContent];
              }
            } else {
              event.Arguments[argField] = textContent;
            }
          } else {
            // For event types (Background/Introduction, etc.)
            event[fieldPath] = textContent;
          }
        });
      }
  
      return {
        ...fileResponse,
        papers
      };
    } catch (error) {
      console.error('Error fetching file with annotations:', error);
      throw this.formatError(error);
    }
  }

  async saveAnnotation(annotation) {
    const { fileId, paperIndex, eventIndex, fieldPath, answer, isDelete } = annotation;
  
    if (!fileId || paperIndex === undefined || eventIndex === undefined || !fieldPath) {
      throw new Error('Missing required fields');
    }
  
    try {
      // Get existing annotations count for arrayIndex
      const existingResponse = await api.annotations.get(fileId, {
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath
      });
  
      const arrayIndex = existingResponse?.annotations?.length || 0;
  
      const response = await api.annotations.save({
        fileId,
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath,
        answer,
        arrayIndex,
        isDelete: Boolean(isDelete)
      });
  
      return response.annotation;
    } catch (error) {
      console.error('Error in saveAnnotation:', { error, annotation });
      throw this.formatError(error);
    }
  }

  async syncAnnotations(fileId, annotations) {
    if (!fileId || !Array.isArray(annotations) || annotations.length === 0) {
      throw new Error('Invalid sync parameters');
    }
  
    try {
      // Add arrayIndex to each annotation if not present
      const annotationsWithIndex = annotations.map((ann, index) => ({
        ...ann,
        arrayIndex: ann.arrayIndex ?? index
      }));
  
      return await api.annotations.sync(fileId, { annotations: annotationsWithIndex });
    } catch (error) {
      throw this.formatError(error);
    }
  }

  formatError(error) {
    return {
      message: error.message || 'An error occurred',
      status: error.status || 500,
      details: error.details || null
    };
  }
}
export const annotationApi = new AnnotationApi();
export { FIELD_TYPES, ANNOTATION_FIELDS };