// hooks/useAnnotationHandlers.js
import { useCallback } from 'react';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/annotation';

export const useAnnotationHandlers = ({
  currentEvent,
  currentPosition,
  setLocalFileData,
  setSelectedText,
  setLastSaved,
  syncAnnotation,
  showSnackbar
}) => {
  const validateAnnotation = useCallback((selection, eventText) => {
    if (!selection || !eventText) return false;

    const textContainerRef = document.createElement('div');
    textContainerRef.textContent = eventText;
    const range = document.createRange();
    const tempTextNode = textContainerRef.firstChild;
    
    if (!tempTextNode) return false;

    try {
      range.setStart(tempTextNode, selection.start);
      range.setEnd(tempTextNode, selection.end);
      const textAtPosition = eventText.substring(selection.start, selection.end);
      return textAtPosition === selection.text.trim();
    } catch (error) {
      console.error("validateAnnotation error:", error);
      return false;
    }
  }, []);

  const handleAnnotationSelect = useCallback(async (type, selection) => {
    if (!selection || !currentPosition) return;

    try {
      if (type === 'Main Action' && currentEvent['Main Action']) {
        showSnackbar(ERROR_MESSAGES.MAIN_ACTION_EXISTS, "error");
        return;
      }

      if (!validateAnnotation(selection, currentEvent?.Text)) {
        showSnackbar(ERROR_MESSAGES.INVALID_SELECTION, "error");
        return;
      }

      const annotationData = {
        text: selection.text.trim(),
        span: { start: selection.start, end: selection.end }
      };

      const fieldPath = type.startsWith('Object.') ? 
        `Arguments.Object.${type.slice(7)}` : 
        !type.startsWith('Arguments.') && type !== 'Main Action' ? 
          `Arguments.${type}` : type;

      const response = await syncAnnotation({
        fieldPath,
        answer: annotationData,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex
      });

      if (!response.success) throw new Error('Failed to save');

      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        const spanWithId = { 
          ...annotationData.span,
          annotationId: response.data.annotationId
        };

        updateEventData(currentEvent, type, annotationData, spanWithId);
        return newData;
      });

      setSelectedText(null);
      setLastSaved(new Date());
      showSnackbar(SUCCESS_MESSAGES.ANNOTATION_SAVED, "success");
    } catch (error) {
      console.error("Save error:", error);
      showSnackbar(ERROR_MESSAGES.SAVE_FAILED, "error");
    }
  }, [currentPosition, currentEvent, syncAnnotation, validateAnnotation]);

  const handleAnnotationDelete = useCallback(async (type, annotationId) => {
    if (!currentPosition) return;

    try {
      const fieldPath = type.startsWith('Object.') ? 
        `Arguments.Object.${type.slice(7)}` : 
        type.startsWith('Arguments.') ? type : type;

      const response = await syncAnnotation({
        fieldPath,
        answer: null,
        isDelete: true,
        paperIndex: currentPosition.paperIndex,
        eventIndex: currentPosition.eventIndex,
        annotationId
      });

      if (!response.success) throw new Error('Failed to delete');

      setLocalFileData(prev => {
        if (!prev?.papers) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const currentEvent = newData.papers[currentPosition.paperIndex].events[currentPosition.eventIndex];
        
        if (!currentEvent) return prev;
        handleEventDataDeletion(currentEvent, type, annotationId);
        return newData;
      });

      setLastSaved(new Date());
      showSnackbar(SUCCESS_MESSAGES.ANNOTATION_DELETED, "success");
    } catch (error) {
      console.error('Delete error:', error);
      showSnackbar(ERROR_MESSAGES.DELETE_FAILED, "error");
    }
  }, [currentPosition, syncAnnotation]);

  return {
    handleAnnotationSelect,
    handleAnnotationDelete,
    validateAnnotation
  };
};

// Helper functions
function updateEventData(currentEvent, type, annotationData, spanWithId) {
  if (!currentEvent.Arguments) currentEvent.Arguments = {};
  if (!currentEvent.ArgumentPositions) currentEvent.ArgumentPositions = {};

  if (type === 'Main Action') {
    currentEvent['Main Action'] = annotationData.text;
    currentEvent.ArgumentPositions['Main Action'] = [spanWithId];
    return;
  }

  if (type.startsWith('Arguments.Object.')) {
    const objectType = type.split('.').pop();
    if (!currentEvent.Arguments.Object) currentEvent.Arguments.Object = {};
    if (!currentEvent.Arguments.Object[objectType]) {
      currentEvent.Arguments.Object[objectType] = [];
    }
    currentEvent.Arguments.Object[objectType].push(annotationData.text);
    currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`] = 
      currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`] || [];
    currentEvent.ArgumentPositions[`Arguments.Object.${objectType}`].push(spanWithId);
    return;
  }

  const argumentType = type.replace('Arguments.', '');
  if (!currentEvent.Arguments[argumentType]) {
    currentEvent.Arguments[argumentType] = [];
  }
  currentEvent.Arguments[argumentType].push(annotationData.text);
  const fieldPath = `Arguments.${argumentType}`;
  currentEvent.ArgumentPositions[fieldPath] = currentEvent.ArgumentPositions[fieldPath] || [];
  currentEvent.ArgumentPositions[fieldPath].push(spanWithId);
}

function handleEventDataDeletion(currentEvent, type, annotationId) {
  if (type === 'Main Action') {
    currentEvent['Main Action'] = '';
    delete currentEvent.ArgumentPositions?.['Main Action'];
    return;
  }

  const fieldPath = type.startsWith('Object.') ? 
    `Arguments.Object.${type.slice(7)}` : 
    `Arguments.${type.replace('Arguments.', '')}`;

  const positions = currentEvent.ArgumentPositions?.[fieldPath] || [];
  const posIndex = positions.findIndex(p => p.annotationId === annotationId);

  if (posIndex > -1) {
    positions.splice(posIndex, 1);
    
    if (type.startsWith('Arguments.Object.')) {
      const objectKey = type.split('.').pop();
      currentEvent.Arguments.Object[objectKey].splice(posIndex, 1);
      if (currentEvent.Arguments.Object[objectKey].length === 0) {
        delete currentEvent.Arguments.Object[objectKey];
      }
    } else {
      const argType = type.replace('Arguments.', '');
      currentEvent.Arguments[argType].splice(posIndex, 1);
      if (currentEvent.Arguments[argType].length === 0) {
        delete currentEvent.Arguments[argType];
      }
    }
  }
}