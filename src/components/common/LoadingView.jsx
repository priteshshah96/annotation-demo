// components/common/LoadingView.jsx
import React, { memo } from 'react';

const LoadingView = () => (
  <div className="flex justify-center items-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
);

export default memo(LoadingView);
