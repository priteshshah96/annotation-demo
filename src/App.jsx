import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();
  
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
      <SignedOut>
        <Routes>
          <Route 
            path="/sign-in/*" 
            element={<SignIn 
              routing="path" 
              path="/sign-in"
              signUpUrl="/sign-up"
              afterSignInUrl="/"
            />} 
          />
          <Route 
            path="/sign-up/*" 
            element={<SignUp 
              routing="path" 
              path="/sign-up"
              signInUrl="/sign-in"
              afterSignUpUrl="/"
            />} 
          />
          {/* Redirect to sign-in for any other routes when signed out */}
          <Route path="*" element={<Navigate to="/sign-in" replace />} />
        </Routes>
      </SignedOut>

      <SignedIn>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<UserDashboard />} />
            <Route path="/file/:fileId" element={<UserAnnotationDashboard mode="view" />} />
            <Route path="/annotate/:fileId" element={<UserAnnotationDashboard mode="edit" />} />
            {/* Redirect to dashboard for undefined routes when signed in */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </SignedIn>
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