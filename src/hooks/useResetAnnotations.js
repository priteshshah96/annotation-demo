import { useState, useCallback } from 'react';
import { annotationApi } from '../services/annotationApi';

export const useResetAnnotations = (fileId) => {
  const [isResetting, setIsResetting] = useState(false);

  const resetAnnotations = useCallback(async () => {
    if (!fileId) return;
    
    setIsResetting(true);
    try {
      // Use the annotationApi's deleteAnnotations method
      await annotationApi.deleteAnnotations(fileId);

      // Clear progress in local storage
      localStorage.removeItem(`last-position-${fileId}`);

      // Refresh file data to update progress
      await annotationApi.getFileWithAnnotations(fileId);

      return true;
    } catch (error) {
      console.error('Error resetting annotations:', error);
      throw error;
    } finally {
      setIsResetting(false);
    }
  }, [fileId]);

  return {
    resetAnnotations,
    isResetting
  };
};

export default useResetAnnotations;