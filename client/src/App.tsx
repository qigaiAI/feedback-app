import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { api } from './api/client';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Loading from './components/Loading';
import LoginPage from './pages/LoginPage';
import StudentList from './pages/StudentList';
import StudentDetail from './pages/StudentDetail';
import FeedbackNew from './pages/FeedbackNew';
import FeedbackResult from './pages/FeedbackResult';
import Settings from './pages/Settings';
import Templates from './pages/Templates';

function VerifyRequired({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.email_verified) return <VerifyEmailPage />;
  return <>{children}</>;
}

function VerifyEmailPage() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  if (!user) return <Navigate to="/login" replace />;
  if (user.email_verified) return <Navigate to="/" replace />;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true);
    setMessage('');
    try {
      await api.post('/api/auth/verify-email', { code: code.trim() });
      window.location.reload();
    } catch (err: any) {
      setMessage(err.response?.data?.error || '验证码错误');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMessage('');
    try {
      await api.post('/api/auth/resend-verification');
      setMessage('验证码已重新发送');
    } catch {
      setMessage('发送失败，请稍后重试');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">📧</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">验证您的邮箱</h1>
        <p className="text-gray-500 text-sm mb-1">
          验证码已发送至 <b>{user.email}</b>
        </p>
        <p className="text-gray-400 text-xs">请输入邮件中的6位验证码以继续使用</p>
      </div>

      <form onSubmit={handleVerify} className="w-full space-y-4">
        <input
          className="input text-center text-lg tracking-widest"
          placeholder="输入6位验证码"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          inputMode="numeric"
          autoFocus
        />
        {message && (
          <div className={`text-sm text-center rounded-lg px-4 py-2 ${
            message.includes('成功') || message.includes('已发送') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>{message}</div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={verifying || code.length < 6}>
          {verifying ? '验证中...' : '验证'}
        </button>
        <button type="button" onClick={handleResend} disabled={resending} className="btn-secondary w-full">
          {resending ? '发送中...' : '重新发送验证码'}
        </button>
        <button type="button" onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }} className="w-full text-sm text-gray-400 py-2">
          退出登录
        </button>
      </form>
    </div>
  );
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
        <Route path="/" element={<VerifyRequired><FeedbackNew /></VerifyRequired>} />
        <Route path="/feedback/new" element={<VerifyRequired><FeedbackNew /></VerifyRequired>} />
        <Route path="/feedback/result" element={<VerifyRequired><FeedbackResult /></VerifyRequired>} />
        <Route path="/students" element={<VerifyRequired><StudentList /></VerifyRequired>} />
        <Route path="/students/:id" element={<VerifyRequired><StudentDetail /></VerifyRequired>} />
        <Route path="/templates" element={<VerifyRequired><Templates /></VerifyRequired>} />
        <Route path="/settings" element={<VerifyRequired><Settings /></VerifyRequired>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navbar />
    </div>
  );
}
