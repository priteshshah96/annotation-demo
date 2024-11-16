// src/lib/annotationStorage.js
import { api } from './api';

export const saveAnnotation = async ({ fileId, abstractIndex, sentenceIndex, entityIndex, answer }) => {
  try {
    // Save to localStorage first
    const annotationKey = `annotation-${fileId}-${abstractIndex}-${sentenceIndex}-${entityIndex}`;
    localStorage.setItem(annotationKey, JSON.stringify({
      answer,
      timestamp: new Date().toISOString()
    }));

    // Then save to server using our API client
    await api.annotations.save({
      fileId,
      abstractIndex,
      sentenceIndex,
      entityIndex,
      answer
    });

    return true;
  } catch (error) {
    console.error('Error saving annotation:', error);
    throw error;
  }
};

export const loadFileAnnotations = async (fileId) => {
  try {
    // Load local annotations
    const localAnnotations = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`annotation-${fileId}`)) {
        localAnnotations[key] = JSON.parse(localStorage.getItem(key));
      }
    }

    // Fetch from server using API client
    const { annotations: serverAnnotations } = await api.annotations.get(fileId);

    // Merge server annotations with local ones
    Object.entries(serverAnnotations).forEach(([key, annotation]) => {
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
    
    // Gather local annotations
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`annotation-${fileId}`)) {
        const [_, __, abstractIndex, sentenceIndex, entityIndex] = key.split('-');
        const data = JSON.parse(localStorage.getItem(key));
        
        localAnnotations.push({
          fileId,
          abstractIndex: parseInt(abstractIndex),
          sentenceIndex: parseInt(sentenceIndex),
          entityIndex: parseInt(entityIndex),
          answer: data.answer,
          timestamp: data.timestamp
        });
      }
    }

    // Sync with server using API client
    if (localAnnotations.length > 0) {
      await api.annotations.sync(fileId, { annotations: localAnnotations });
    }

    return true;
  } catch (error) {
    console.error('Error syncing annotations:', error);
    throw error;
  }
};