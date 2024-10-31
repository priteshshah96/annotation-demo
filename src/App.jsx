import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import UserDashboard from './components/UserDashboard';
import UserAnnotationDashboard from './components/UserAnnotationDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserDashboard />} />
        <Route path="/annotate/:fileId" element={<UserAnnotationDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;