// hooks/useAnnotationState.js
import { useState, useEffect, useMemo } from 'react';
import { AnnotationTypes } from '../models/Annotation';

export const useAnnotationState = (fileData, currentPosition) => {
  const [localFileData, setLocalFileData] = useState(null);
  const [selectedText, setSelectedText] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (fileData) {
      setLocalFileData(fileData);
    }
  }, [fileData]);

  const currentEvent = useMemo(() => {
    if (!localFileData?.papers) return null;
    return localFileData.papers[currentPosition.paperIndex]?.events[currentPosition.eventIndex];
  }, [localFileData, currentPosition]);

  const eventType = useMemo(() => {
    if (!currentEvent) return null;
    return AnnotationTypes.EVENT_TYPE.find(type => 
      currentEvent[type]?.trim() || type in currentEvent
    );
  }, [currentEvent]);

  const progress = useMemo(() => {
    if (!localFileData?.papers) return 0;
    const totalEvents = localFileData.papers.reduce((sum, paper) => sum + paper.events.length, 0);
    const currentTotal = (currentPosition.paperIndex * localFileData.papers[currentPosition.paperIndex].events.length) 
                      + currentPosition.eventIndex;
    return Math.min(((currentTotal + 1) / totalEvents) * 100, 100);
  }, [localFileData, currentPosition]);

  return {
    localFileData,
    setLocalFileData,
    selectedText,
    setSelectedText,
    lastSaved,
    setLastSaved,
    isCompleting,
    setIsCompleting,
    currentEvent,
    eventType,
    progress
  };
};