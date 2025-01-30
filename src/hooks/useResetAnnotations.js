import { useState, useCallback } from 'react';
import { fileApi } from '../services/fileApi';
import { annotationApi } from '../services/annotationApi';

export const useResetAnnotations = (fileId) => {
  const [isResetting, setIsResetting] = useState(false);

  const resetAnnotations = useCallback(async () => {
    if (!fileId) return;
    
    setIsResetting(true);
    try {
      // First reset annotations on the server
      await fileApi.resetAnnotations(fileId);

      // Clear progress in local storage
      localStorage.removeItem(`last-position-${fileId}`);

      // Refresh file data with cleared annotations
      const refreshedFile = await annotationApi.getFileWithAnnotations(fileId);

      return refreshedFile;
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