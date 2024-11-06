import { ClerkProvider, SignIn, SignUp } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();
  
  // Make sure this key is available
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  
  if (!clerkPubKey) {
    console.error("Missing Clerk Publishable Key");
    return <div>Configuration Error</div>;
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      navigate={(to) => navigate(to)}
    >
      <Routes>
        <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
        <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />
        <Route path="/" element={<UserDashboard />} />
        <Route path="/file/:fileId" element={<UserAnnotationDashboard mode="view" />} />
        <Route path="/annotate/:fileId" element={<UserAnnotationDashboard mode="edit" />} />
      </Routes>
    </ClerkProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ClerkProviderWithRoutes />
    </BrowserRouter>
  );
}

export default App;
