// constants/annotationTypes.js

// Event types remain exactly as they were in original code
export const EVENT_TYPES = [
    'Background/Introduction',
    'Methods/Approach',
    'Results/Findings',
    'Conclusions/Implications'
  ];
  
  // Field paths and their data types
  export const FIELD_TYPES = {
    // String fields (single value)
    EVENT_TYPE: EVENT_TYPES,
    MAIN_ACTION: 'Main Action',
    TEXT: 'Text',
  
    // Array fields (multiple values allowed)
    ARGUMENTS: {
      AGENT: 'Arguments.Agent',
      OBJECT: {
        BASE_OBJECT: 'Arguments.Object.Base Object',
        BASE_MODIFIER: 'Arguments.Object.Base Modifier',
        ATTACHED_OBJECT: 'Arguments.Object.Attached Object',
        ATTACHED_MODIFIER: 'Arguments.Object.Attached Modifier'
      },
      CONTEXT: 'Arguments.Context',
      PURPOSE: 'Arguments.Purpose',
      METHOD: 'Arguments.Method',
      RESULTS: 'Arguments.Results',
      ANALYSIS: 'Arguments.Analysis',
      CHALLENGE: 'Arguments.Challenge',
      ETHICAL: 'Arguments.Ethical',
      IMPLICATIONS: 'Arguments.Implications',
      CONTRADICTIONS: 'Arguments.Contradictions'
    }
  };
  
  // Helper to check if a field should be an array
  export const isArrayField = (fieldPath) => {
    return fieldPath.startsWith('Arguments.');
  };
  
  // Helper to check if a field should be a single value
  export const isSingleValueField = (fieldPath) => {
    return fieldPath === FIELD_TYPES.MAIN_ACTION || 
           EVENT_TYPES.includes(fieldPath) ||
           fieldPath === FIELD_TYPES.TEXT;
  };
  
  // Display names for fields (used in UI)
  export const FIELD_DISPLAY_NAMES = {
    [FIELD_TYPES.MAIN_ACTION]: 'Main Action',
    [FIELD_TYPES.ARGUMENTS.AGENT]: 'Agent',
    [FIELD_TYPES.ARGUMENTS.OBJECT.BASE_OBJECT]: 'Base Object',
    [FIELD_TYPES.ARGUMENTS.OBJECT.BASE_MODIFIER]: 'Base Modifier',
    [FIELD_TYPES.ARGUMENTS.OBJECT.ATTACHED_OBJECT]: 'Attached Object',
    [FIELD_TYPES.ARGUMENTS.OBJECT.ATTACHED_MODIFIER]: 'Attached Modifier',
    [FIELD_TYPES.ARGUMENTS.CONTEXT]: 'Context',
    [FIELD_TYPES.ARGUMENTS.PURPOSE]: 'Purpose',
    [FIELD_TYPES.ARGUMENTS.METHOD]: 'Method',
    [FIELD_TYPES.ARGUMENTS.RESULTS]: 'Results',
    [FIELD_TYPES.ARGUMENTS.ANALYSIS]: 'Analysis',
    [FIELD_TYPES.ARGUMENTS.CHALLENGE]: 'Challenge',
    [FIELD_TYPES.ARGUMENTS.ETHICAL]: 'Ethical',
    [FIELD_TYPES.ARGUMENTS.IMPLICATIONS]: 'Implications',
    [FIELD_TYPES.ARGUMENTS.CONTRADICTIONS]: 'Contradictions'
  };
  
  // Initial empty state for all fields
  export const getInitialFieldState = () => ({
    Text: '',
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
  });
  
  // For processing annotations
  export const processAnnotation = (annotation) => {
    const { fieldPath, answer } = annotation;
  
    // For array fields (Arguments)
    if (isArrayField(fieldPath)) {
      return {
        type: fieldPath,
        value: Array.isArray(answer) ? answer : [answer],
        isArray: true
      };
    }
  
    // For single value fields (Main Action, Event Types)
    return {
      type: fieldPath,
      value: answer,
      isArray: false
    };
  };
  
  // For validating field values
  export const validateFieldValue = (fieldPath, value) => {
    if (isArrayField(fieldPath)) {
      // Ensure array fields have array values
      if (!Array.isArray(value)) {
        throw new Error(`Field ${fieldPath} expects an array value`);
      }
    } else if (isSingleValueField(fieldPath)) {
      // Ensure single value fields have string values
      if (Array.isArray(value)) {
        throw new Error(`Field ${fieldPath} expects a single value`);
      }
      if (typeof value !== 'string') {
        throw new Error(`Field ${fieldPath} expects a string value`);
      }
    }
    return true;
  };