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
          'Main Action': ''
        }))
      }));

      // Apply annotations to papers
      if (annotationsResponse?.annotations) {
        annotationsResponse.annotations.forEach(annotation => {
          const { paperIndex, eventIndex, fieldPath, answer } = annotation;
          if (!papers[paperIndex]?.events[eventIndex]) return;

          if (fieldPath === 'Main Action') {
            papers[paperIndex].events[eventIndex]['Main Action'] = answer;
          } else if (fieldPath.startsWith('Arguments.Object.')) {
            const objectField = fieldPath.replace('Arguments.Object.', '');
            papers[paperIndex].events[eventIndex].Arguments.Object[objectField] = answer;
          } else if (fieldPath.startsWith('Arguments.')) {
            const argField = fieldPath.replace('Arguments.', '');
            papers[paperIndex].events[eventIndex].Arguments[argField] = answer;
          } else {
            papers[paperIndex].events[eventIndex][fieldPath] = answer;
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
      const response = await api.annotations.save({
        fileId,
        paperIndex: Number(paperIndex),
        eventIndex: Number(eventIndex),
        fieldPath,
        answer,
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
      return await api.annotations.sync(fileId, { annotations });
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