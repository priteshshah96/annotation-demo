// src/lib/annotationStorage.js
export const saveAnnotation = async ({ fileId, paperIndex, eventIndex, fieldPath, answer }) => {
  try {
    // First save to localStorage for immediate feedback
    const annotationKey = `annotation-${fileId}-${paperIndex}-${eventIndex}-${fieldPath}`;
    localStorage.setItem(annotationKey, JSON.stringify({
      answer,
      timestamp: new Date().toISOString()
    }));

    // Then persist to MongoDB
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
        answer
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save annotation to server');
    }

    return true;
  } catch (error) {
    console.error('Error saving annotation:', error);
    throw error;
  }
};

export const loadFileAnnotations = async (fileId) => {
  try {
    // First try to load from localStorage
    const localAnnotations = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`annotation-${fileId}`)) {
        localAnnotations[key] = JSON.parse(localStorage.getItem(key));
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
      
      if (!localAnnotation || new Date(annotation.timestamp) > new Date(localAnnotation.timestamp)) {
        localStorage.setItem(key, JSON.stringify({
          answer: annotation.answer,
          timestamp: annotation.timestamp
        }));
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
        
        localAnnotations.push({
          fileId,
          paperIndex: parseInt(paperIndex),
          eventIndex: parseInt(eventIndex),
          fieldPath: fieldPathParts.join('-'), // Rejoin fieldPath parts in case it contained hyphens
          answer: data.answer,
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