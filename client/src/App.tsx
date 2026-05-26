import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Loading from './components/Loading';
import LoginPage from './pages/LoginPage';
import StudentList from './pages/StudentList';
import StudentDetail from './pages/StudentDetail';
import FeedbackNew from './pages/FeedbackNew';
import FeedbackResult from './pages/FeedbackResult';
import Settings from './pages/Settings';
import Templates from './pages/Templates';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="max-w-lg mx-auto min-h-screen pb-16">
      {/* 测试版标识 */}
      <div className="bg-orange-500 text-white text-center text-xs font-bold py-1.5 tracking-wide">
        ⚠ 测试版 — 数据不与正式版互通
      </div>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><FeedbackNew /></ProtectedRoute>} />
        <Route path="/feedback/new" element={<ProtectedRoute><FeedbackNew /></ProtectedRoute>} />
        <Route path="/feedback/result" element={<ProtectedRoute><FeedbackResult /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute><StudentList /></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute><StudentDetail /></ProtectedRoute>} />
        <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navbar />
    </div>
  );
}
