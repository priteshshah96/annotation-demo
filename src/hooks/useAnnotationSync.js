// useAnnotationSync.js
import { useState, useCallback } from 'react';
import { annotationApi } from '../services/annotationApi';
import { AnnotationTypes } from '../models/Annotation';

const SYNC_STATES = {
  SAVED: 'saved',
  SAVING: 'saving',
  ERROR: 'error'
};

export function useAnnotationSync(fileId, userId) {
  const [syncStatus, setSyncStatus] = useState({ 
    show: false, 
    status: SYNC_STATES.SAVED,
    lastSync: null
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const updateSyncStatus = useCallback((status) => {
    setSyncStatus(prev => ({
      ...prev,
      show: true,
      status,
      lastSync: status === SYNC_STATES.SAVED ? new Date().toISOString() : prev.lastSync
    }));
  }, []);

  const syncAnnotation = useCallback(async (annotation) => {
    if (!annotation || isSyncing || !userId) return;

    try {
      setIsSyncing(true);
      updateSyncStatus(SYNC_STATES.SAVING);
      
      // Normalize field path
      const fieldPath = annotation.fieldPath.startsWith('Object.') ? 
        `Arguments.${annotation.fieldPath}` : annotation.fieldPath;

      const isEventType = AnnotationTypes.EVENT_TYPE.includes(fieldPath);
      const isMainAction = fieldPath === AnnotationTypes.MAIN_ACTION;
      const isArgument = fieldPath.startsWith('Arguments.');

      // Process the answer based on field type
      let processedAnswer;
      if (isEventType) {
        processedAnswer = String(annotation.value || '');
      } else if (isMainAction) {
        processedAnswer = {
          text: String(annotation.value || ''),
          spans: [{
            text: String(annotation.value || ''),
            start: 0,
            end: String(annotation.value || '').length
          }]
        };
      } else if (isArgument) {
        const spans = annotation.span ? [annotation.span] : 
          (Array.isArray(annotation.spans) ? annotation.spans : []);
        processedAnswer = {
          text: spans.map(s => s.text).join(' '),
          spans: spans.sort((a, b) => a.start - b.start)
        };
      }

      const apiPayload = {
        fileId,
        userId,
        paperIndex: Number(annotation.paperIndex),
        eventIndex: Number(annotation.eventIndex),
        fieldPath,
        answer: processedAnswer,
        isDelete: annotation.isDelete
      };
      
      await annotationApi.saveAnnotation(apiPayload);
      updateSyncStatus(SYNC_STATES.SAVED);
      
    } catch (error) {
      console.error('Sync error:', error);
      updateSyncStatus(SYNC_STATES.ERROR);
    } finally {
      setIsSyncing(false);
    }
  }, [fileId, userId, isSyncing, updateSyncStatus]);

  return {
    syncStatus,
    syncAnnotation,
    isSyncing
  };
}

export { SYNC_STATES };
export default useAnnotationSync;