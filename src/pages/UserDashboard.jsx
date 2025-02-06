import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  CircularProgress
} from '@mui/material';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

// Components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import StatsPanel from '../components/dashboard/StatsPanel';
import FileList from '../components/dashboard/FileList';
import FileActionsMenu from '../components/dashboard/FileActionsMenu';

// Services & Utilities
import { fileApi } from '../services/fileApi';
import Toast from '../components/annotation/Toast';


const UserDashboard = () => {
  // Auth & Navigation
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const { userId } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  // State Management
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [toasts, setToasts] = useState([]);  

   // Toast handlers
   const showToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };
  
  const hideToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Navigation Handlers
  const handleNavigate = (path) => {
    navigate(path);
  };

  // Menu Handlers
  const handleMenuOpen = (event, fileId) => {
    event.stopPropagation();
    setSelectedFileId(fileId);
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedFileId(null);
  };

  // File Actions
  const handleDeleteFile = async () => {
    try {
      await fileApi.deleteFile(selectedFileId);
      await fetchDashboardData();
      showToast('File deleted successfully', 'success');
    } catch (error) {
      showToast('Error deleting file', 'error');
    }
    handleMenuClose();
  };

  const handleExportFile = async () => {
    try {
      const response = await fileApi.getFile(selectedFileId);
      const blob = new Blob([JSON.stringify(response.file, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `annotations_${selectedFileId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Export successful', 'success');
    } catch (error) {
      showToast('Error exporting file', 'error');
    }
    handleMenuClose();
  };

  const handleResetAnnotations = async () => {
    try {
      handleNavigate(`/annotate/${selectedFileId}`);
      showToast('Navigating to annotation page...', 'info');
    } catch (error) {
      showToast('Error navigating to annotation page', 'error');
    }
    handleMenuClose();
  };

  // Data Fetching
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fileApi.getFiles();
      const filesWithData = response.files?.map(file => ({
        ...file,
        abstracts: file.abstracts || [],
        progress: file.progress || 0
      })) || [];
      setFiles(filesWithData);
    } catch (error) {
      showToast('Error loading dashboard data', 'error');
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Documentation Dialog
  const renderDocsDialog = () => {
    if (!showDocs) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl w-[800px] mx-4 p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Dashboard Guide</h2>
            <button
              onClick={() => setShowDocs(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close documentation"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Overview */}
            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Dashboard Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Total Papers</h4>
                  <p className="text-blue-800 text-sm">Shows total papers across all your files</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Total Events</h4>
                  <p className="text-blue-800 text-sm">Shows total events needing annotation</p>
                </div>
              </div>
            </section>

            {/* File Upload */}
            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">File Upload</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 mb-3">Your JSON files must contain:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-2">
                  <li>Paper code for each paper</li>
                  <li>Abstract text</li>
                  <li>Events with Text field</li>
                </ul>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    <strong>Note:</strong> Make sure your JSON file follows the required structure.
                  </p>
                </div>
              </div>
            </section>

            {/* File Actions */}
            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Available Actions</h3>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg flex items-start gap-3">
                  <div className="text-blue-600 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">View Annotations</h4>
                    <p className="text-gray-600 text-sm">Review existing annotations without making changes</p>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg flex items-start gap-3">
                  <div className="text-gray-600 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">Download Annotations</h4>
                    <p className="text-gray-600 text-sm">Export annotated data as JSON</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg flex items-start gap-3">
                  <div className="text-orange-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 2v6h6"/>
                      <path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">Reset Annotations</h4>
                    <p className="text-gray-600 text-sm">Clear all annotations and start fresh</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg flex items-start gap-3">
                  <div className="text-red-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">Delete File</h4>
                    <p className="text-gray-600 text-sm">Permanently remove the file</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Annotation Process */}
            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Annotation Process</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <ol className="list-decimal list-inside space-y-3 text-blue-900">
                  <li>Click the "Annotate" button on any file to begin</li>
                  <li>For each event:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-blue-800">
                      <li>First identify and mark the Main Action</li>
                      <li>Add annotations for Arguments, Context, etc.</li>
                      <li>Progress saves automatically</li>
                    </ul>
                  </li>
                  <li>Use Previous/Next buttons to navigate between events</li>
                  <li>Complete all events to finish annotation</li>
                </ol>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={() => setShowDocs(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close Guide
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Effects
  useEffect(() => {
    if (isUserLoaded && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isUserLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (isUserLoaded && isSignedIn) {
      fetchDashboardData();

      const handleAnnotationUpdate = () => {
        fetchDashboardData();
      };

      window.addEventListener('annotationUpdate', handleAnnotationUpdate);
      return () => {
        window.removeEventListener('annotationUpdate', handleAnnotationUpdate);
      };
    }
  }, [isUserLoaded, isSignedIn]);

  // Loading State
  if (!isUserLoaded || loading) {
    return (
      <Container sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <DashboardHeader
        userName={user?.firstName || user?.username}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        avatarUrl={user?.imageUrl}
        onSignOut={signOut}
        onHelp={() => setShowDocs(true)}
      />

      {renderDocsDialog()}

      <StatsPanel files={files} loading={loading} />

      <Paper elevation={3} sx={{ padding: 3 }}>
        <Typography variant="h6" gutterBottom>
          Your Files
        </Typography>

        <FileList
          files={files}
          onMenuOpen={handleMenuOpen}
          onNavigate={handleNavigate}
          selectedFileId={selectedFileId}
          loading={loading}
          userId={userId}
          onUpload={fetchDashboardData}
        />

        <FileActionsMenu
          anchorEl={menuAnchorEl}
          onClose={handleMenuClose}
          onDelete={handleDeleteFile}
          onExport={handleExportFile}
          onReset={handleResetAnnotations}
          onNavigate={handleNavigate}
          file={files.find(f => f._id === selectedFileId)}
          disabledActions={!selectedFileId ? ['export', 'delete', 'reset', 'view'] : []}
        />
      </Paper>

      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => hideToast(toast.id)}
          index={index}
        />
      ))}
    </Container>
  );
};

export default UserDashboard;