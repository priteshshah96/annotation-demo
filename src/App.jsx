// App.jsx
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import UserDashboard from './pages/UserDashboard';
import UserAnnotationDashboard from './pages/UserAnnotationDashboard';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing Clerk Publishable Key");
}

const ProtectedRoute = ({ children }) => {
  const { isSignedIn, isLoaded } = useAuth();
  
  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
};

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();

  return (
    <ClerkProvider 
      publishableKey={clerkPubKey}
      navigate={(to) => navigate(to)}
      appearance={{
        baseTheme: "dark",
        variables: {
          colorPrimary: "rgb(79, 70, 229)",
          colorBackground: "rgb(17, 24, 39)",
          colorText: "white",
          colorTextSecondary: "rgb(156, 163, 175)",
          colorInputBackground: "rgb(31, 41, 55)",
          colorInputText: "white",
          fontFamily: "Inter, sans-serif",
          borderRadius: "0.5rem"
        },
        elements: {
          card: {
            backgroundColor: "rgb(24, 31, 41)",
            borderRadius: "1rem",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
          },
          formButtonPrimary: {
            backgroundColor: "rgb(79, 70, 229)",
            "&:hover": {
              backgroundColor: "rgb(67, 56, 202)"
            }
          },
          formFieldInput: {
            borderColor: "rgb(75, 85, 99)",
            "&:focus": {
              borderColor: "rgb(79, 70, 229)",
              boxShadow: "0 0 0 2px rgba(79, 70, 229, 0.25)"
            }
          },
          rootBox: {
            width: "100%",
            margin: "0 auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh"
          }
        }
      }}
    >
      <Routes>
        <Route 
          path="/sign-in/*" 
          element={
            <div className="flex justify-center items-center min-h-screen w-full">
              <SignIn 
                path="/sign-in"
                routing="path"
                redirectToRoute="/"
              />
            </div>
          } 
        />

        <Route 
          path="/sign-up/*" 
          element={
            <div className="flex justify-center items-center min-h-screen w-full">
              <SignUp 
                path="/sign-up"
                routing="path"
                redirectToRoute="/"
              />
            </div>
          } 
        />
        
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/file/:fileId" 
          element={
            <ProtectedRoute>
              <UserAnnotationDashboard mode="view" />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/annotate/:fileId" 
          element={
            <ProtectedRoute>
              <UserAnnotationDashboard mode="edit" />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
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