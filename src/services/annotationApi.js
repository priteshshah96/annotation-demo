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

const isArgumentField = (fieldPath) => {
  return fieldPath.startsWith('Arguments.') || fieldPath.startsWith('Object.');
};

const normalizeFieldPath = (fieldPath) => {
  if (fieldPath.startsWith('Arguments.Object.')) {
    return fieldPath.replace('Arguments.Object.', 'Object.');
  } else if (fieldPath.startsWith('Object.')) {
    return `Arguments.${fieldPath}`;
  }
  return fieldPath;
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
        events: paper.events.map(event => {
          // Determine the event type
          const eventType = AnnotationTypes.EVENT_TYPE.find(
            type => event[type] !== undefined
          );
  
          // Build the event object with only the relevant event type
          const cleanedEvent = {
            ...event,
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
            'Main Action': '' // Treat Main Action as a string
          };
  
          // Only include the relevant event type
          if (eventType) {
            cleanedEvent[eventType] = event[eventType] || '';
          }
  
          return cleanedEvent;
        })
      }));
  
      if (annotationsResponse?.annotations) {
        annotationsResponse.annotations.forEach(annotation => {
          const { paperIndex, eventIndex, fieldPath, answer } = annotation;
          if (!papers[paperIndex]?.events[eventIndex]) return;
  
          const normalizedPath = normalizeFieldPath(fieldPath);
  
          if (normalizedPath === 'Main Action') {
            papers[paperIndex].events[eventIndex]['Main Action'] = answer || ''; // Treat as string
          } else if (isArgumentField(normalizedPath)) {
            if (normalizedPath.startsWith('Arguments.Object.')) {
              const objectField = normalizedPath.replace('Arguments.Object.', '');
              papers[paperIndex].events[eventIndex].Arguments.Object[objectField] =
                Array.isArray(answer) ? answer : [];
            } else if (normalizedPath.startsWith('Arguments.')) {
              const argField = normalizedPath.replace('Arguments.', '');
              papers[paperIndex].events[eventIndex].Arguments[argField] =
                Array.isArray(answer) ? answer : [];
            }
          } else {
            papers[paperIndex].events[eventIndex][normalizedPath] = answer || '';
          }
        });
      }
  
      console.log('Processed file data with annotations:', papers); // Log for debugging
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
    const { 
      fileId, 
      paperIndex, 
      eventIndex, 
      fieldPath, 
      answer, 
      isDelete,
      index 
    } = annotation;
  
    if (!fileId || paperIndex === undefined || eventIndex === undefined || !fieldPath) {
      throw new Error('Missing required fields');
    }
  
    try {
      const normalizedPath = normalizeFieldPath(fieldPath);
      let newAnswer;
  
      if (normalizedPath === 'Main Action') {
        if (typeof answer === 'string') {
          newAnswer = answer.trim();
        } else if (answer && typeof answer === 'object') {
          newAnswer = answer.text || '';
        } else {
          newAnswer = '';
        }
      } else if (isArgumentField(normalizedPath)) {
        try {
          const currentAnnotation = await api.annotations.get(fileId, {
            paperIndex: Number(paperIndex),
            eventIndex: Number(eventIndex),
            fieldPath: normalizedPath
          });
  
          if (isDelete) {
            if (index !== undefined && Array.isArray(currentAnnotation?.answer)) {
              newAnswer = currentAnnotation.answer.filter((_, i) => i !== index);
            } else {
              newAnswer = [];
            }
          } else {
            const currentSpans = Array.isArray(currentAnnotation?.answer) ? 
              currentAnnotation.answer : [];
            
            const newSpan = {
              text: answer.text,
              start: answer.start,
              end: answer.end
            };
            
            newAnswer = [...currentSpans, newSpan]
              .sort((a, b) => a.start - b.start)
              .filter(span => span.text && 
                            typeof span.start === 'number' && 
                            typeof span.end === 'number');
          }
        } catch (error) {
          if (!isDelete) {
            newAnswer = [{
              text: answer.text,
              start: answer.start,
              end: answer.end
            }];
          } else {
            newAnswer = [];
          }
        }
      } else {
        newAnswer = isDelete ? '' : answer;
      }
  
      const payload = {
        fileId,
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath: normalizedPath,
        answer: newAnswer,
        isDelete: Boolean(isDelete)
      };
  
      const response = await api.annotations.save(payload);
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
      const processedAnnotations = annotations.map(ann => {
        const normalizedPath = normalizeFieldPath(ann.fieldPath);

        if (normalizedPath === 'Main Action') {
          return {
            ...ann,
            answer: {
              text: ann.answer?.trim() || '',
              spans: ann.answer?.trim() ? [{
                text: ann.answer.trim(),
                start: 0,
                end: ann.answer.trim().length
              }] : []
            }
          };
        } else if (isArgumentField(normalizedPath)) {
          return {
            ...ann,
            answer: Array.isArray(ann.answer) ? ann.answer : []
          };
        }
        return ann;
      });

      return await api.annotations.sync(fileId, { 
        annotations: processedAnnotations 
      });
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