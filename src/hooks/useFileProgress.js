import { useState, useEffect, useCallback } from 'react';

export function useFileProgress(fileId) {
  const [progress, setProgress] = useState(0);
  
  const calculateProgress = useCallback(() => {
    try {
      let totalSteps = 0;
      let completedSteps = 0;
      
      // Get total steps from file data
      const fileDataKey = `file-data-${fileId}`;
      const fileData = localStorage.getItem(fileDataKey);
      
      if (fileData) {
        const data = JSON.parse(fileData);
        // Calculate total possible steps from file structure
        data.abstracts.forEach(abstract => {
          abstract.sentences.forEach(sentence => {
            totalSteps += sentence.scientific_entities.length + 1; // +1 for sentence itself
          });
        });
      }

      // Count completed annotations
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(`annotation-${fileId}`)) {
          const annotation = JSON.parse(localStorage.getItem(key));
          if (annotation?.answer) {
            completedSteps++;
          }
        }
      }

      // Calculate and return progress percentage
      const progressValue = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      return Math.min(100, Math.max(0, progressValue)); // Ensure between 0-100
    } catch (error) {
      console.error('Error calculating progress:', error);
      return 0;
    }
  }, [fileId]);

  const updateProgress = useCallback(() => {
    const newProgress = calculateProgress();
    setProgress(newProgress);
  }, [calculateProgress]);

  // Initial calculation
  useEffect(() => {
    updateProgress();
  }, [updateProgress]);

  // Update on localStorage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key?.startsWith(`annotation-${fileId}`) || 
          e.key === `file-data-${fileId}`) {
        updateProgress();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Add a custom event listener for local updates
    window.addEventListener('annotationUpdate', updateProgress);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('annotationUpdate', updateProgress);
    };
  }, [fileId, updateProgress]);

  return progress;
}

export default useFileProgress;