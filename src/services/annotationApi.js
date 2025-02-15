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
      if (!fileResponse.success || !fileResponse.file) {
        throw new Error('File not found');
      }

      const annotationsResponse = await api.annotations.get(fileId);
      console.log('Annotations response:', annotationsResponse);

      // Get papers from the file object and ensure it's an array
      const papers = fileResponse.file.papers?.map(paper => ({
        ...paper,
        events: paper.events?.map(event => {
          const { Text, ...eventTypes } = event;
          const eventType = AnnotationTypes.EVENT_TYPE.find(type => type in eventTypes);

          return {
            [eventType]: "",  // Original event type with empty string
            Text,  // Original Text
            'Main Action': "",
            Arguments: {
              Agent: [],
              Object: {
                'Primary Object': [],
                'Primary Modifier': [],
                'Secondary Object': [],
                'Secondary Modifier': []
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
            ArgumentPositions: {}
          };
        }) || []
      })) || [];

      if (annotationsResponse?.annotations) {
        annotationsResponse.annotations.forEach(annotation => {
          const { paperIndex, eventIndex, fieldPath, answer, annotationId } = annotation;
          if (!papers[paperIndex]?.events[eventIndex]) return;

          const event = papers[paperIndex].events[eventIndex];
          const textContent = answer?.text || answer;
          const span = answer?.span || null;

          if (AnnotationTypes.EVENT_TYPE.includes(fieldPath)) {
            event[fieldPath] = textContent;
            if (!event.ArgumentPositions[fieldPath]) {
              event.ArgumentPositions[fieldPath] = [];
            }
            event.ArgumentPositions[fieldPath] = [{
              annotationId,
              text: textContent
            }];
          }
          else if (fieldPath === 'Main Action') {
            event['Main Action'] = textContent;
            if (span) {
              event.ArgumentPositions['Main Action'] = [{
                ...span,
                annotationId
              }];
            }
          } 
          else if (fieldPath.startsWith('Arguments.Object.')) {
            const objectField = fieldPath.replace('Arguments.Object.', '');
            if (Array.isArray(event.Arguments.Object[objectField])) {
              event.Arguments.Object[objectField].push(textContent);
            } else {
              event.Arguments.Object[objectField] = [textContent];
            }
            if (span) {
              if (!event.ArgumentPositions[fieldPath]) {
                event.ArgumentPositions[fieldPath] = [];
              }
              event.ArgumentPositions[fieldPath].push({
                ...span,
                annotationId
              });
            }
          } 
          else if (fieldPath.startsWith('Arguments.')) {
            const argField = fieldPath.replace('Arguments.', '');
            if (Array.isArray(event.Arguments[argField])) {
              event.Arguments[argField].push(textContent);
            } else {
              event.Arguments[argField] = [textContent];
            }
            if (span) {
              if (!event.ArgumentPositions[fieldPath]) {
                event.ArgumentPositions[fieldPath] = [];
              }
              event.ArgumentPositions[fieldPath].push({
                ...span,
                annotationId
              });
            }
          }
        });
      }

      console.log('Processed papers:', papers);
      return {
        ...fileResponse,
        file: {
          ...fileResponse.file,
          papers
        }
      };
    } catch (error) {
      console.error('Error fetching file with annotations:', error);
      throw this.formatError(error);
    }
  }

  async saveAnnotation(annotation) {
    const { fileId, paperIndex, eventIndex, fieldPath, answer, isDelete, annotationId } = annotation;

    if (!fileId || paperIndex === undefined || eventIndex === undefined || !fieldPath) {
      throw new Error('Missing required fields');
    }

    try {
      const payload = {
        fileId,
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath,
        answer,
        isDelete: Boolean(isDelete),
        annotationId
      };

      if (fieldPath !== 'Main Action') {
        const existingResponse = await api.annotations.get(fileId, {
          paperIndex: Number(paperIndex),
          eventIndex: Number(eventIndex),
          fieldPath
        });
        payload.arrayIndex = existingResponse?.annotations?.length || 0;
      }

      const response = await api.annotations.save(payload);
      return response.annotation;
    } catch (error) {
      console.error('Error in saveAnnotation:', { error, annotation });
      throw this.formatError(error);
    }
  }

  async syncAnnotations(fileId, annotations = []) {
    if (!fileId) {
      throw new Error('FileId is required');
    }

    try {
      const annotationsWithIndex = annotations.map((ann, index) => ({
        ...ann,
        arrayIndex: ann.fieldPath !== 'Main Action' ? (ann.arrayIndex ?? index) : undefined
      }));

      return await api.annotations.sync(fileId, { 
        annotations: annotationsWithIndex 
      });
    } catch (error) {
      throw this.formatError(error);
    }
  }

  async finalizeAnnotations(fileId) {
    if (!fileId) {
      throw new Error('FileId is required');
    }

    try {
      return await api.annotations.sync(fileId, { 
        finalize: true,
        completed: true
      });
    } catch (error) {
      console.error('Error finalizing annotations:', error);
      throw this.formatError(error);
    }
  }

  async resetAnnotations(fileId) {
    if (!fileId) {
      throw new Error('FileId is required');
    }

    try {
      const response = await api.annotations.reset(fileId);
      if (!response.success) {
        throw new Error('Failed to reset annotations');
      }

      // Fetch the updated file data to ensure progress is reset
      const updatedFile = await this.getFileWithAnnotations(fileId);
      return updatedFile;
    } catch (error) {
      console.error('Error resetting annotations:', error);
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