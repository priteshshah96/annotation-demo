import { AnnotationTypes } from '../models/Annotation.js';

/**
 * Process and validate annotation answer based on field type
 */
export const processAnnotationAnswer = (fieldPath, answer) => {
  if (!fieldPath) {
    throw new Error('Field path is required');
  }

  // Event Types (Background/Introduction etc)
  if (AnnotationTypes.EVENT_TYPE.includes(fieldPath)) {
    return processEventType(answer);
  }
  
  // Main Action
  if (fieldPath === AnnotationTypes.MAIN_ACTION) {
    return processMainAction(answer);
  }
  
  // Arguments (including Object fields)
  if (fieldPath.startsWith('Arguments.') || fieldPath.startsWith('Object.')) {
    return processArgument(answer);
  }

  throw new Error('Invalid field path');
};

/**
 * Validate basic annotation fields
 */
export const validateAnnotationFields = (fileId, paperIndex, eventIndex, fieldPath) => {
  const errors = [];
  
  if (!fileId) errors.push('File ID is required');
  if (typeof paperIndex !== 'number' || paperIndex < 0) errors.push('Invalid paper index');
  if (typeof eventIndex !== 'number' || eventIndex < 0) errors.push('Invalid event index');
  if (!fieldPath) errors.push('Field path is required');

  return errors;
};

/**
 * Check for span overlaps in an array of spans
 */
export const hasOverlappingSpans = (spans) => {
  if (!Array.isArray(spans) || spans.length < 2) return false;
  
  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);
  
  for (let i = 0; i < sortedSpans.length - 1; i++) {
    if (sortedSpans[i].end > sortedSpans[i + 1].start) {
      return true;
    }
  }
  
  return false;
};

// Private helper functions

const processEventType = (answer) => {
  if (!answer) return '';
  
  if (typeof answer === 'string') {
    return answer.trim();
  }

  if (answer && typeof answer === 'object' && answer.text) {
    return String(answer.text).trim();
  }

  return '';
};

const processMainAction = (answer) => {
  if (!answer) {
    return { text: '', spans: [] };
  }

  if (typeof answer === 'string') {
    const trimmedText = answer.trim();
    return {
      text: trimmedText,
      spans: trimmedText ? [{
        text: trimmedText,
        start: 0,
        end: trimmedText.length
      }] : []
    };
  }
  
  if (typeof answer === 'object') {
    // If answer has text and spans properties
    if (answer.text !== undefined && answer.spans !== undefined) {
      const text = String(answer.text || '').trim();
      const spans = Array.isArray(answer.spans) 
        ? validateAndProcessSpans(answer.spans)
        : text ? [{ text, start: 0, end: text.length }] : [];
      
      return { text, spans };
    }

    // If answer is a single span object
    if (answer.text && typeof answer.start === 'number' && typeof answer.end === 'number') {
      return {
        text: String(answer.text).trim(),
        spans: [validateAndProcessSpan(answer)]
      };
    }
  }
  
  return { text: '', spans: [] };
};

const processArgument = (answer) => {
  if (!answer) {
    return { text: '', spans: [] };
  }

  let spans = [];

  // Handle string input
  if (typeof answer === 'string') {
    const trimmedText = answer.trim();
    if (trimmedText) {
      spans = [{
        text: trimmedText,
        start: 0,
        end: trimmedText.length
      }];
    }
  } 
  // Handle object input
  else if (typeof answer === 'object') {
    // If it's an array of spans
    if (Array.isArray(answer)) {
      spans = validateAndProcessSpans(answer);
    }
    // If it has text and spans properties
    else if (answer.text !== undefined && answer.spans !== undefined) {
      spans = Array.isArray(answer.spans) 
        ? validateAndProcessSpans(answer.spans)
        : [];
    }
    // If it's a single span object
    else if (answer.text && typeof answer.start === 'number' && typeof answer.end === 'number') {
      spans = [validateAndProcessSpan(answer)];
    }
  }

  return {
    text: spans.map(s => s.text).join(' '),
    spans
  };
};

const validateAndProcessSpan = (span) => {
  return {
    text: String(span.text || '').trim(),
    start: Number(span.start) || 0,
    end: Number(span.end) || (span.text ? String(span.text).length : 0)
  };
};

const validateAndProcessSpans = (spans) => {
  if (!Array.isArray(spans)) return [];

  return spans
    .filter(span => span && span.text)
    .map(validateAndProcessSpan)
    .filter(span => 
      span.text && 
      typeof span.start === 'number' && 
      typeof span.end === 'number' &&
      span.start >= 0 && 
      span.end > span.start
    )
    .sort((a, b) => a.start - b.start);
};