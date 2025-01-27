// constants/annotation.js
export const SYNC_STATUS_STYLES = {
    SAVED: 'text-green-600',
    SAVING: 'text-blue-600',
    ERROR: 'text-red-600',
    OFFLINE: 'text-orange-600'
  };
  
  export const SYNC_STATUS_MESSAGES = {
    SAVED: 'All changes saved',
    SAVING: 'Saving changes...',
    ERROR: 'Error saving changes',
    OFFLINE: 'Working offline'
  };
  
  export const ERROR_MESSAGES = {
    INVALID_SELECTION: 'Invalid selection',
    MAIN_ACTION_EXISTS: 'Please delete existing Main Action before adding a new one',
    SAVE_FAILED: 'Failed to save',
    DELETE_FAILED: 'Failed to delete',
    NO_DATA: 'No data available for annotation.'
  };
  
  export const SUCCESS_MESSAGES = {
    ANNOTATION_SAVED: 'Annotation saved',
    ANNOTATION_DELETED: 'Annotation deleted successfully',
    SUMMARY_SAVED: 'Summary saved successfully'
  };