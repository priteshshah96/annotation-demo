// src/lib/utils.js

const EVENT_TYPES = [
  'Background/Introduction',
  'Methods/Approach',
  'Results/Findings',
  'Conclusions/Implications'
];

const REQUIRED_ARGUMENT_FIELDS = [
  'Agent',
  'Object',
  'Context',
  'Purpose',
  'Method',
  'Results',
  'Analysis',
  'Challenge',
  'Ethical',
  'Implications',
  'Contradictions'
];

class ValidationError extends Error {
  constructor(message, path = '') {
    super(message);
    this.name = 'ValidationError';
    this.path = path;
  }
}

export const validateFileStructure = (data) => {
  if (!Array.isArray(data)) {
    throw new ValidationError('Invalid file format: Root should be an array of abstracts');
  }

  // Validate each abstract
  for (const [abstractIndex, abstract] of data.entries()) {
    const abstractPath = `abstract[${abstractIndex}]`;

    // Check required abstract fields
    if (!abstract.paper_code || typeof abstract.paper_code !== 'string') {
      throw new ValidationError('Missing or invalid paper_code', abstractPath);
    }

    if (!abstract.abstract || typeof abstract.abstract !== 'string') {
      throw new ValidationError('Missing or invalid abstract text', abstractPath);
    }

    if (!Array.isArray(abstract.events)) {
      throw new ValidationError('events must be an array', abstractPath);
    }

    if (abstract.events.length === 0) {
      throw new ValidationError('events array cannot be empty', abstractPath);
    }

    // Validate each event
    for (const [eventIndex, event] of abstract.events.entries()) {
      const eventPath = `${abstractPath}.events[${eventIndex}]`;

      // Check if the event has one of the valid event types as a property
      const hasValidType = EVENT_TYPES.some(type => type in event);
      if (!hasValidType) {
        throw new ValidationError(
          `Event must have one of these types as a property: ${EVENT_TYPES.join(', ')}`,
          eventPath
        );
      }

      // Check event text
      if (!event.Text || typeof event.Text !== 'string') {
        throw new ValidationError('Missing or invalid Text field', eventPath);
      }

      // Validate Main Action field exists
      if (!('Main Action' in event)) {
        throw new ValidationError('Missing Main Action field', eventPath);
      }

      // Validate Arguments object
      if (!event.Arguments || typeof event.Arguments !== 'object') {
        throw new ValidationError('Missing or invalid Arguments object', eventPath);
      }

      // Validate Object structure
      if (!event.Arguments.Object || typeof event.Arguments.Object !== 'object') {
        throw new ValidationError('Missing or invalid Arguments.Object structure', eventPath);
      }

      // Validate Object fields
      const requiredObjectFields = [
        'Base Object',
        'Base Modifier',
        'Attached Object',
        'Attached Modifier'
      ];

      for (const field of requiredObjectFields) {
        if (!(field in event.Arguments.Object)) {
          throw new ValidationError(
            `Missing ${field} in Arguments.Object`,
            `${eventPath}.Arguments.Object`
          );
        }
      }

      // Validate required argument fields
      for (const field of REQUIRED_ARGUMENT_FIELDS) {
        if (field !== 'Object' && !(field in event.Arguments)) {
          throw new ValidationError(
            `Missing ${field} in Arguments`,
            `${eventPath}.Arguments`
          );
        }
      }
    }
  }

  return true;
};

export const calculateTotalSteps = (data) => {
  if (!Array.isArray(data)) return 0;

  return data.reduce((totalSteps, abstract) => {
    if (!abstract.events || !Array.isArray(abstract.events)) {
      return totalSteps;
    }

    return totalSteps + abstract.events.reduce((eventSteps, event) => {
      let steps = 0;

      // Count filled event types
      EVENT_TYPES.forEach(type => {
        if (event[type] && event[type].trim()) steps += 1;
      });

      // Count Main Action if not empty
      if (event['Main Action']?.trim()) steps += 1;

      // Count Arguments
      if (event.Arguments) {
        // Count filled direct arguments
        REQUIRED_ARGUMENT_FIELDS
          .filter(field => field !== 'Object')
          .forEach(field => {
            if (event.Arguments[field]?.trim()) steps += 1;
          });

        // Count filled Object fields
        if (event.Arguments.Object) {
          ['Base Object', 'Base Modifier', 'Attached Object', 'Attached Modifier']
            .forEach(field => {
              if (event.Arguments.Object[field]?.trim()) steps += 1;
            });
        }
      }

      return eventSteps + steps;
    }, 0);
  }, 0);
};

export const formatError = (error) => {
  if (error instanceof ValidationError) {
    return {
      message: error.message,
      path: error.path,
      type: 'ValidationError'
    };
  }
  
  if (error.response?.data?.message) {
    return {
      message: error.response.data.message,
      type: 'ApiError'
    };
  }
  
  return {
    message: error.message || 'An error occurred',
    type: 'GeneralError'
  };
};