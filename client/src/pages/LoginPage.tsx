import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

type Mode = 'login' | 'register' | 'reset';

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  if (user) return <Navigate to="/" replace />;

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!email) { setError('请先输入邮箱'); return; }
    setError('');
    setSendingCode(true);
    try {
      await api.post('/api/email/send-code', { email, type: 'reset' });
      startCountdown();
    } catch (err: any) {
      setError(err.response?.data?.error || '发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register' && password !== confirmPassword) {
        setError('两次输入的密码不一致');
        setSubmitting(false);
        return;
      }
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'register') {
        await register(email, password, name, '');
      } else if (mode === 'reset') {
        await api.post('/api/auth/reset-password', { email, password, code });
        setError('');
        alert('密码重置成功，请登录');
        setMode('login');
        setCode('');
        setPassword('');
        return;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m); setError(''); setCode(''); setCountdown(0); setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary-600 mb-2">课后反馈助手</h1>
        <p className="text-gray-500 text-sm">30秒生成专业课后反馈</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {mode === 'register' && (
          <div>
            <label className="label">姓名</label>
            <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" required />
          </div>
        )}

        <div>
          <label className="label">邮箱</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="请输入邮箱" required />
        </div>

        {mode === 'reset' && (
          <div>
            <label className="label">验证码</label>
            <div className="flex gap-2">
              <input type="text" className="input flex-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6位验证码" maxLength={6} required />
              <button type="button" className="btn-primary whitespace-nowrap" onClick={handleSendCode} disabled={countdown > 0 || sendingCode}>
                {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="label">{mode === 'reset' ? '新密码' : '密码'}</label>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码（至少6位）" required minLength={6} />
        </div>

        {mode === 'register' && (
          <div>
            <label className="label">确认密码</label>
            <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="请再次输入密码" required minLength={6} />
          </div>
        )}

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? '处理中...' : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码'}
        </button>
      </form>

      <div className="mt-4 text-sm space-y-2 text-center">
        {mode === 'login' ? (
          <>
            <button className="text-primary-600 w-full py-1" onClick={() => switchMode('register')}>没有账号？去注册</button>
            <br />
            <button className="text-gray-400 w-full py-1" onClick={() => switchMode('reset')}>忘记密码？</button>
          </>
        ) : mode === 'register' ? (
          <button className="text-primary-600 w-full py-1" onClick={() => switchMode('login')}>已有账号？去登录</button>
        ) : (
          <button className="text-primary-600 w-full py-1" onClick={() => switchMode('login')}>返回登录</button>
        )}
      </div>
    </div>
  );
}
