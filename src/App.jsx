import { ClerkProvider, SignIn, SignUp } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();
  
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (!clerkPubKey) {
    console.error("Missing Clerk Publishable Key");
    return <div>Configuration Error</div>;
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      navigate={(to) => navigate(to)}
      // Add Clerk configuration
      options={{
        baseUrl: apiUrl,
        timeoutMs: 10000,
        retryAttempts: 2
      }}
    >
      <AuthProvider
        apiUrl={apiUrl}
        onError={(error) => {
          console.error('Auth error:', error);
          navigate('/sign-in');
        }}
      >
        <Routes>
          <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
          <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
          <Route path="/" element={<UserDashboard />} />
          <Route path="/file/:fileId" element={<UserAnnotationDashboard mode="view" />} />
          <Route path="/annotate/:fileId" element={<UserAnnotationDashboard mode="edit" />} />
        </Routes>
      </AuthProvider>
    </ClerkProvider>
  );
}