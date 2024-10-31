// dashboardHelpers.js

const locks = new Set();

const acquireLock = (fileId) => {
  const lockKey = `lock-${fileId}`;
  if (locks.has(lockKey)) {
    return false;
  }
  locks.add(lockKey);
  return true;
};

const releaseLock = (fileId) => {
  const lockKey = `lock-${fileId}`;
  locks.delete(lockKey);
};

export const calculateTotalSteps = (data) => {
  if (!data?.abstracts) return 0;
  return data.abstracts.reduce((total, abstract) => {
    return total + abstract.sentences.reduce((sentTotal, sentence) => {
      return sentTotal + sentence.scientific_entities.length + 1;
    }, 0);
  }, 0);
};

export const calculateFileProgress = async (fileId) => {
  if (!acquireLock(fileId)) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        resolve(await calculateFileProgress(fileId));
      }, 100);
    });
  }

  try {
    const fileData = JSON.parse(localStorage.getItem(`file-data-${fileId}`));
    if (!fileData?.abstracts) {
      releaseLock(fileId);
      return 0;
    }

    let totalRequired = 0;
    let completedAnnotations = 0;
    const startTime = Date.now();

    const checkTimeout = () => {
      if (Date.now() - startTime > 5000) {
        throw new Error('Operation timed out');
      }
    };

    for (const [abstractIndex, abstract] of fileData.abstracts.entries()) {
      checkTimeout();
      for (const [sentenceIndex, sentence] of abstract.sentences.entries()) {
        totalRequired++;
        
        const sentenceKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}--1`;
        const sentenceAnnotation = localStorage.getItem(sentenceKey);
        if (sentenceAnnotation && JSON.parse(sentenceAnnotation).answer) {
          completedAnnotations++;
        }

        for (const [entityIndex] of sentence.scientific_entities.entries()) {
          totalRequired++;
          const entityKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`;
          const entityAnnotation = localStorage.getItem(entityKey);
          if (entityAnnotation && JSON.parse(entityAnnotation).answer) {
            completedAnnotations++;
          }
        }
      }
    }

    const progress = totalRequired > 0 ? (completedAnnotations / totalRequired) * 100 : 0;
    return Math.round(progress * 10) / 10;
  } catch (error) {
    console.error('Error calculating file progress:', error);
    return 0;
  } finally {
    releaseLock(fileId);
  }
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

export const saveAnnotation = async (fileId, abstractIndex, sentenceIndex, entityIndex, answer) => {
  if (!acquireLock(fileId)) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        resolve(await saveAnnotation(fileId, abstractIndex, sentenceIndex, entityIndex, answer));
      }, 100);
    });
  }

  try {
    const fileData = JSON.parse(localStorage.getItem(`file-data-${fileId}`));
    if (!fileData?.abstracts?.[abstractIndex]?.sentences?.[sentenceIndex]) {
      throw new Error('Invalid indexes');
    }

    const sentence = fileData.abstracts[abstractIndex].sentences[sentenceIndex];
    if (entityIndex !== -1 && !sentence.scientific_entities[entityIndex]) {
      throw new Error('Invalid entity index');
    }

    const annotationKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`;
    
    // Save the annotation
    localStorage.setItem(annotationKey, JSON.stringify({
      answer,
      timestamp: new Date().toISOString()
    }));

    // Update progress
    const progress = await calculateFileProgress(fileId);
    fileData.progress = progress;
    localStorage.setItem(`file-data-${fileId}`, JSON.stringify(fileData));

    return true;
  } catch (error) {
    console.error('Error saving annotation:', error);
    throw error;
  } finally {
    releaseLock(fileId);
  }
};

export const calculateStats = async () => {
  const stats = {
    totalAnnotations: 0,
    completedFiles: 0,
    totalSentences: 0,
    totalEntities: 0,
    completedAnnotations: 0
  };

  try {
    const fileKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('file-data-'));

    for (const fileKey of fileKeys) {
      const fileData = JSON.parse(localStorage.getItem(fileKey));
      const fileId = fileKey.replace('file-data-', '');

      fileData.abstracts.forEach((abstract, abstractIndex) => {
        abstract.sentences.forEach((sentence, sentenceIndex) => {
          stats.totalSentences++;
          stats.totalEntities += sentence.scientific_entities.length;

          const sentenceKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}--1`;
          const sentenceAnnotation = localStorage.getItem(sentenceKey);
          if (sentenceAnnotation && JSON.parse(sentenceAnnotation).answer) {
            stats.completedAnnotations++;
          }

          sentence.scientific_entities.forEach((_, entityIndex) => {
            const entityKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`;
            const entityAnnotation = localStorage.getItem(entityKey);
            if (entityAnnotation && JSON.parse(entityAnnotation).answer) {
              stats.completedAnnotations++;
            }
          });
        });
      });

      const progress = await calculateFileProgress(fileId);
      if (progress === 100) {
        stats.completedFiles++;
      }
    }

    stats.totalAnnotations = stats.totalSentences + stats.totalEntities;
    return stats;
  } catch (error) {
    console.error('Error calculating stats:', error);
    return stats;
  }
};

export const cleanupFileData = (fileId) => {
  try {
    const fileData = JSON.parse(localStorage.getItem(`file-data-${fileId}`));
    if (!fileData?.abstracts) return;

    fileData.abstracts.forEach((abstract, abstractIndex) => {
      abstract.sentences.forEach((sentence, sentenceIndex) => {
        localStorage.removeItem(`annotation-${fileId}-${abstractIndex}-${sentenceIndex}--1`);
        
        sentence.scientific_entities.forEach((_, entityIndex) => {
          localStorage.removeItem(`annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`);
        });
      });
    });

    localStorage.removeItem(`file-data-${fileId}`);
    localStorage.removeItem(`last-position-${fileId}`);
  } catch (error) {
    console.error('Error cleaning up file data:', error);
    throw error;
  }
};

export const clearAnnotations = (fileId) => {
  try {
    const fileData = JSON.parse(localStorage.getItem(`file-data-${fileId}`));
    if (!fileData?.abstracts) return;

    fileData.abstracts.forEach((abstract, abstractIndex) => {
      abstract.sentences.forEach((sentence, sentenceIndex) => {
        localStorage.removeItem(`annotation-${fileId}-${abstractIndex}-${sentenceIndex}--1`);
        
        sentence.scientific_entities.forEach((_, entityIndex) => {
          localStorage.removeItem(`annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`);
        });
      });
    });

    fileData.progress = 0;
    localStorage.setItem(`file-data-${fileId}`, JSON.stringify(fileData));
    localStorage.removeItem(`last-position-${fileId}`);
  } catch (error) {
    console.error('Error clearing annotations:', error);
    throw error;
  }
};

export const exportAnnotations = (fileId) => {
  try {
    const fileData = JSON.parse(localStorage.getItem(`file-data-${fileId}`));
    if (!fileData?.abstracts) throw new Error('No file data found');

    const annotations = {
      file_name: fileData.name,
      export_date: new Date().toISOString(),
      abstracts: fileData.abstracts.map((abstract, abstractIndex) => ({
        paper_code: abstract.paper_code,
        abstract: abstract.abstract,
        sentences: abstract.sentences.map((sentence, sentenceIndex) => {
          const sentenceKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}--1`;
          const sentenceAnnotation = localStorage.getItem(sentenceKey);
          const sentenceType = sentenceAnnotation ? JSON.parse(sentenceAnnotation).answer : null;

          const entityAnnotations = sentence.scientific_entities.map((entity, entityIndex) => {
            const entityKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`;
            const entityAnnotation = localStorage.getItem(entityKey);
            
            return {
              entity: entity.entity,
              type: entityAnnotation ? JSON.parse(entityAnnotation).answer : null
            };
          });

          return {
            sentence_code: sentence.sentence_code,
            text: sentence.text,
            sentence_type: sentenceType,
            scientific_entities: entityAnnotations
          };
        })
      }))
    };

    return {
      data: annotations,
      filename: fileData.name.replace('.json', '_annotated.json')
    };
  } catch (error) {
    console.error('Error preparing annotations for export:', error);
    throw error;
  }
};

export const getStoredFiles = async () => {
  try {
    const fileKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('file-data-'));
    
    const files = await Promise.all(fileKeys.map(async (key) => {
      const fileData = JSON.parse(localStorage.getItem(key));
      const fileId = key.replace('file-data-', '');
      const progress = await calculateFileProgress(fileId);
      return { ...fileData, id: fileId, progress };
    }));

    return files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  } catch (error) {
    console.error('Error getting stored files:', error);
    return [];
  }
};

// Cleanup expired locks periodically
setInterval(() => {
  for (const lock of locks) {
    if (lock.startsWith('lock-') && Date.now() - lock.timestamp > 10000) {
      locks.delete(lock);
    }
  }
}, 10000);