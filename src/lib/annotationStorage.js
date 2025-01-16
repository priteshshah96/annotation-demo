// src/lib/annotationStorage.js

const isArgumentField = (fieldPath) => {
  return fieldPath.startsWith('Arguments.') || fieldPath.startsWith('Object.');
};

export const saveAnnotation = async ({ fileId, paperIndex, eventIndex, fieldPath, answer, index, isDelete }) => {
  try {
    const annotationKey = `annotation-${fileId}-${paperIndex}-${eventIndex}-${fieldPath}`;
    
    if (isArgumentField(fieldPath)) {
      // Handle argument fields (array-based)
      let currentValue = [];
      try {
        const stored = localStorage.getItem(annotationKey);
        if (stored) {
          const data = JSON.parse(stored);
          currentValue = Array.isArray(data.answer) ? data.answer : [];
        }
      } catch (e) {
        console.warn('Invalid localStorage entry:', annotationKey);
      }

      if (isDelete) {
        if (index !== undefined) {
          // Remove specific annotation from array
          currentValue = currentValue.filter((_, i) => i !== index);
        } else {
          // Remove entire array
          localStorage.removeItem(annotationKey);
          currentValue = null;
        }
      } else {
        // Add new annotation to array
        currentValue = [...currentValue, answer].sort((a, b) => a.start - b.end);
      }

      if (currentValue && currentValue.length > 0) {
        localStorage.setItem(annotationKey, JSON.stringify({
          answer: currentValue,
          timestamp: new Date().toISOString()
        }));
      } else {
        localStorage.removeItem(annotationKey);
      }
    } else {
      // Handle non-argument fields (string-based)
      if (isDelete) {
        localStorage.removeItem(annotationKey);
      } else {
        localStorage.setItem(annotationKey, JSON.stringify({
          answer,
          timestamp: new Date().toISOString()
        }));
      }
    }

    // Then persist to server
    const token = await window.Clerk.session?.getToken();
    const response = await fetch('/api/annotations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileId,
        paperIndex,
        eventIndex,
        fieldPath,
        answer,
        index,
        isDelete: Boolean(isDelete)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error:', errorData);
      throw new Error(errorData.details || 'Failed to save annotation to server');
    }

    return true;
  } catch (error) {
    console.error('Error in saveAnnotation:', error);
    throw error;
  }
};

export const loadFileAnnotations = async (fileId) => {
  try {
    // First try to load from localStorage
    const localAnnotations = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`annotation-${fileId}`)) {
        try {
          localAnnotations[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          console.warn('Invalid localStorage entry:', key);
          localStorage.removeItem(key);
        }
      }
    }

    // Then fetch from server
    const token = await window.Clerk.session?.getToken();
    const response = await fetch(`/api/annotations/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch annotations from server');
    }

    const serverAnnotations = await response.json();

    // Merge server annotations with local ones, preferring newer timestamps
    serverAnnotations.annotations.forEach(annotation => {
      const key = `annotation-${fileId}-${annotation.paperIndex}-${annotation.eventIndex}-${annotation.fieldPath}`;
      const localAnnotation = localAnnotations[key];
      
      const serverTimestamp = new Date(annotation.timestamp);
      const localTimestamp = localAnnotation ? new Date(localAnnotation.timestamp) : null;

      if (!localAnnotation || serverTimestamp > localTimestamp) {
        if (annotation.isDelete) {
          localStorage.removeItem(key);
        } else {
          let finalAnswer = annotation.answer;
          
          // For argument fields, ensure array format and sort
          if (isArgumentField(annotation.fieldPath) && finalAnswer) {
            finalAnswer = Array.isArray(finalAnswer) ? finalAnswer : [finalAnswer];
            finalAnswer.sort((a, b) => a.start - b.end);
          }

          localStorage.setItem(key, JSON.stringify({
            answer: finalAnswer,
            timestamp: annotation.timestamp
          }));
        }
      }
    });

    return true;
  } catch (error) {
    console.error('Error loading annotations:', error);
    throw error;
  }
};

export const syncAnnotations = async (fileId) => {
  try {
    const localAnnotations = [];
    
    // Gather all local annotations for this file
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`annotation-${fileId}`)) {
        const [_, __, paperIndex, eventIndex, ...fieldPathParts] = key.split('-');
        const data = JSON.parse(localStorage.getItem(key));
        const fieldPath = fieldPathParts.join('-'); // Rejoin fieldPath parts
        
        let answer = data.answer;
        // Ensure array format for argument fields
        if (isArgumentField(fieldPath) && answer && !Array.isArray(answer)) {
          answer = [answer];
        }

        localAnnotations.push({
          fileId,
          paperIndex: parseInt(paperIndex),
          eventIndex: parseInt(eventIndex),
          fieldPath,
          answer,
          timestamp: data.timestamp
        });
      }
    }

    // Batch upload to server
    if (localAnnotations.length > 0) {
      const token = await window.Clerk.session?.getToken();
      const response = await fetch(`/api/annotations/${fileId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ annotations: localAnnotations })
      });

      if (!response.ok) {
        throw new Error('Failed to sync annotations with server');
      }
    }

    return true;
  } catch (error) {
    console.error('Error syncing annotations:', error);
    throw error;
  }
};