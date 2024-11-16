import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
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
      <Routes>
        <Route 
          path="/sign-in/*" 
          element={
            <SignedOut>
              <SignIn 
                routing="path" 
                path="/sign-in"
                signUpUrl="/sign-up"
                afterSignInUrl="/"
              />
            </SignedOut>
          } 
        />
        <Route 
          path="/sign-up/*" 
          element={
            <SignedOut>
              <SignUp 
                routing="path" 
                path="/sign-up"
                signInUrl="/sign-in"
                afterSignUpUrl="/"
              />
            </SignedOut>
          } 
        />
        
        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <SignedIn>
              <AuthProvider>
                <UserDashboard />
              </AuthProvider>
            </SignedIn>
          }
        />
        <Route
          path="/file/:fileId"
          element={
            <SignedIn>
              <AuthProvider>
                <UserAnnotationDashboard mode="view" />
              </AuthProvider>
            </SignedIn>
          }
        />
        <Route
          path="/annotate/:fileId"
          element={
            <SignedIn>
              <AuthProvider>
                <UserAnnotationDashboard mode="edit" />
              </AuthProvider>
            </SignedIn>
          }
        />

        {/* Catch-all redirect */}
        <Route 
          path="*" 
          element={<Navigate to="/sign-in" replace />} 
        />
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