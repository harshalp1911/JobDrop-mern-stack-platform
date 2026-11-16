import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ResumeAnalysis from './pages/ResumeAnalysis';
import InterviewSetup from './pages/InterviewSetup';
import Interview from './pages/Interview';
import Feedback from './pages/Feedback';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" /> : children;
}

export default function App() {
  const location = useLocation();
  const isInterviewPage = /^\/interview\/[^/]+$/.test(location.pathname);

  return (
    <div className={isInterviewPage ? '' : 'min-h-screen bg-slate-50'}>
      {!isInterviewPage && <Navbar />}
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/resume/:id" element={<ProtectedRoute><ResumeAnalysis /></ProtectedRoute>} />
        <Route path="/interview/setup/:resumeId" element={<ProtectedRoute><InterviewSetup /></ProtectedRoute>} />
        <Route path="/interview/:id" element={<ProtectedRoute><Interview /></ProtectedRoute>} />
        <Route path="/interview/:id/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </div>
  );
}
