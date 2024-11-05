import { api } from '../lib/api';

class AnnotationApiService {
  constructor() {
    this.abortController = null;
    this.pendingRequests = new Map();
    this.requestQueue = new Map();
  }

  generateRequestId(method, fileId) {
    return `${method}-${fileId}-${Date.now()}`;
  }

  cancelPendingRequests() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    return this.abortController.signal;
  }

  async queueRequest(requestId, request) {
    const previous = this.requestQueue.get(requestId);
    if (previous) {
      await previous;
    }
    
    const promise = request();
    this.requestQueue.set(requestId, promise);
    
    try {
      const result = await promise;
      this.requestQueue.delete(requestId);
      return result;
    } catch (error) {
      this.requestQueue.delete(requestId);
      throw error;
    }
  }

  async getAnnotations(fileId) {
    const requestId = this.generateRequestId('get', fileId);
    
    try {
      const signal = this.cancelPendingRequests();

      return await this.queueRequest(requestId, async () => {
        const response = await api.annotations.get(fileId, { signal });
        
        if (!response?.annotations) {
          return [];
        }

        // Convert to array format
        return Object.entries(response.annotations).map(([key, value]) => {
          const [abstractIndex, sentenceIndex, entityIndex] = key.split('-').map(Number);
          return {
            fileId,
            abstractIndex,
            sentenceIndex,
            entityIndex,
            answer: value.answer,
            timestamp: value.timestamp
          };
        });
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return [];
      }
      throw error;
    }
  }

  async saveAnnotation(annotation) {
    const { fileId, abstractIndex, sentenceIndex, entityIndex, answer } = annotation;
    const requestId = this.generateRequestId('save', fileId);

    try {
      const signal = this.cancelPendingRequests();
      
      return await this.queueRequest(requestId, async () => {
        // Save to localStorage first for immediate feedback
        this.saveToLocalStorage(fileId, {
          ...annotation,
          timestamp: new Date().toISOString()
        });

        // Then save to server
        return await api.annotations.save({
          fileId,
          abstractIndex,
          sentenceIndex,
          entityIndex,
          answer,
          timestamp: new Date().toISOString()
        }, { signal });
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  async getFileWithAnnotations(fileId) {
    const requestId = this.generateRequestId('getFile', fileId);

    try {
      const signal = this.cancelPendingRequests();

      return await this.queueRequest(requestId, async () => {
        // Fetch file data and annotations in parallel
        const [fileResponse, serverAnnotations] = await Promise.all([
          api.files.get(fileId, { signal }),
          this.getAnnotations(fileId)
        ]);

        if (!fileResponse?.file) {
          throw new Error('File data not found');
        }

        // Load and merge annotations
        const localAnnotations = this.loadLocalAnnotations(fileId);
        await this.mergeAnnotations(fileId, localAnnotations, serverAnnotations);

        return fileResponse.file;
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      }
      throw new Error(`Failed to load file: ${error.message}`);
    }
  }

  saveToLocalStorage(fileId, annotation) {
    const key = `annotation-${fileId}-${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`;
    localStorage.setItem(key, JSON.stringify({
      answer: annotation.answer,
      timestamp: annotation.timestamp
    }));
  }

  loadLocalAnnotations(fileId) {
    const annotations = [];
    try {
      const prefix = `annotation-${fileId}`;
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));

      for (const key of keys) {
        const [_, __, abstractIndex, sentenceIndex, entityIndex] = key.split('-');
        const data = JSON.parse(localStorage.getItem(key));
        
        if (data?.answer) {
          annotations.push({
            fileId,
            abstractIndex: parseInt(abstractIndex),
            sentenceIndex: parseInt(sentenceIndex),
            entityIndex: parseInt(entityIndex),
            answer: data.answer,
            timestamp: data.timestamp
          });
        }
      }
      return annotations;
    } catch (error) {
      console.error('Error loading local annotations:', error);
      return [];
    }
  }

  async mergeAnnotations(fileId, local, server = []) {
    try {
      // Create lookup maps
      const serverMap = new Map(
        server.map(annotation => [
          `${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`,
          annotation
        ])
      );

      const localMap = new Map(
        local.map(annotation => [
          `${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`,
          annotation
        ])
      );

      // Process all annotations
      const allKeys = new Set([...serverMap.keys(), ...localMap.keys()]);
      
      for (const key of allKeys) {
        const serverAnnotation = serverMap.get(key);
        const localAnnotation = localMap.get(key);

        if (!localAnnotation || 
            (serverAnnotation && new Date(serverAnnotation.timestamp) > new Date(localAnnotation.timestamp))) {
          if (serverAnnotation) {
            this.saveToLocalStorage(fileId, serverAnnotation);
          }
        }
      }
    } catch (error) {
      console.error('Error merging annotations:', error);
    }
  }

  async syncAnnotations(fileId, annotations = []) {
    const requestId = this.generateRequestId('sync', fileId);

    try {
      const signal = this.cancelPendingRequests();

      return await this.queueRequest(requestId, async () => {
        const response = await api.annotations.sync(fileId, annotations, { signal });
        
        // Update local storage with confirmed sync
        annotations.forEach(annotation => {
          this.saveToLocalStorage(fileId, {
            ...annotation,
            timestamp: new Date().toISOString()
          });
        });

        return response;
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }


  async deleteAnnotations(fileId) {
    const requestId = this.generateRequestId('delete', fileId);
  
    try {
      const signal = this.cancelPendingRequests();
  
      return await this.queueRequest(requestId, async () => {
        // Use the dedicated reset endpoint instead of sync
        const response = await api.annotations.reset(fileId, { 
          method: 'POST',
          signal 
        });
        
        // Clear local storage annotations
        const prefix = `annotation-${fileId}`;
        const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
        keys.forEach(key => localStorage.removeItem(key));
  
        return response;
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }
}

export const annotationApi = new AnnotationApiService();
