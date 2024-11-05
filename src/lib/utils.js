// src/lib/utils.js
export const calculateTotalSteps = (abstracts) => {
    return abstracts.reduce((total, abstract) => {
      return total + abstract.sentences.reduce((sentTotal, sentence) => {
        return sentTotal + sentence.scientific_entities.length + 1;
      }, 0);
    }, 0);
  };
  
  export const validateFileStructure = (data) => {
    if (!Array.isArray(data)) {
      throw new Error('Invalid file format: Root should be an array of abstracts');
    }
  
    for (const abstract of data) {
      if (!abstract.paper_code || typeof abstract.paper_code !== 'string') {
        throw new Error('Invalid abstract: Missing or invalid paper_code');
      }
      if (!abstract.abstract || typeof abstract.abstract !== 'string') {
        throw new Error('Invalid abstract: Missing or invalid abstract text');
      }
      if (!Array.isArray(abstract.sentences)) {
        throw new Error('Invalid abstract: sentences must be an array');
      }
  
      for (const sentence of abstract.sentences) {
        if (!sentence.sentence_code || typeof sentence.sentence_code !== 'string') {
          throw new Error('Invalid sentence: Missing or invalid sentence_code');
        }
        if (!sentence.text || typeof sentence.text !== 'string') {
          throw new Error('Invalid sentence: Missing or invalid text');
        }
        if (!Array.isArray(sentence.scientific_entities)) {
          throw new Error('Invalid sentence: scientific_entities must be an array');
        }
        for (const entity of sentence.scientific_entities) {
          if (!entity.entity || typeof entity.entity !== 'string') {
            throw new Error('Invalid entity: Missing or invalid entity text');
          }
        }
      }
    }
    return true;
  };
  
  export const formatError = (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    return error.message || 'An error occurred';
  };