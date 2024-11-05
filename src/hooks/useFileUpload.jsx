// src/hooks/useFileUpload.jsx
import { useState } from 'react';
import { fileApi } from '../services/fileApi';

export const useFileUpload = ({ onSuccess, onError }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file) => {
    try {
      setIsUploading(true);

      // Read file content
      const fileContent = await file.text();
      const parsedContent = JSON.parse(fileContent);

      // Upload file
      const response = await fileApi.uploadFile({
        name: file.name,
        content: parsedContent
      });

      onSuccess?.(response);
      return response;
    } catch (error) {
      console.error('File upload error:', error);
      onError?.(error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    handleUpload,
    isUploading
  };
};

export default useFileUpload;