import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Forgot password state
  const [forgotMode, setForgotMode] = useState<'none' | 'send' | 'reset'>('none');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, password, name);
        setRegisteredEmail(email);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setSubmitting(true);
    setForgotMsg('');
    try {
      const res = await api.post('/api/auth/forgot-password', { email: forgotEmail });
      setResetToken(res.data.reset_token);
      setForgotMsg(res.data.message || '验证码已发送');
      setForgotMode('reset');
    } catch (err: any) {
      setForgotMsg(err.response?.data?.error || '发送失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode || !newPassword) return;
    setSubmitting(true);
    setForgotMsg('');
    try {
      await api.post('/api/auth/reset-password', {
        email: forgotEmail,
        code: resetCode,
        new_password: newPassword,
        reset_token: resetToken,
      });
      setForgotMsg('密码重置成功，请登录');
      setForgotMode('none');
      setEmail(forgotEmail);
      setPassword('');
    } catch (err: any) {
      setForgotMsg(err.response?.data?.error || '重置失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Show verification message after registration
  if (registeredEmail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">验证码已发送</h1>
          <p className="text-gray-500 text-sm mb-1">
            验证码已发送至 <b>{registeredEmail}</b>
          </p>
          <p className="text-gray-400 text-xs">请查收邮件，登录后在页面顶部输入验证码完成验证。</p>
        </div>
        <button
          onClick={() => { setRegisteredEmail(''); setIsRegister(false); setEmail(''); setPassword(''); }}
          className="btn-primary w-full"
        >
          去登录
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary-600 mb-2">课后反馈助手</h1>
        <p className="text-gray-500 text-sm">30秒生成专业课后反馈</p>
      </div>

      {forgotMode === 'none' ? (
        <>
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {isRegister && (
              <div>
                <label className="label">昵称</label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入昵称"
                  required
                />
              </div>
            )}
            <div>
              <label className="label">邮箱</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                required
              />
            </div>
            <div>
              <label className="label">密码</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码（至少6位）"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>

            <div className="flex justify-between">
              <button
                type="button"
                className="text-sm text-primary-600 py-2"
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
              >
                {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
              </button>
              {!isRegister && (
                <button
                  type="button"
                  className="text-sm text-gray-400 py-2"
                  onClick={() => { setForgotMode('send'); setForgotEmail(email); setForgotMsg(''); }}
                >
                  忘记密码？
                </button>
              )}
            </div>
          </form>
        </>
      ) : forgotMode === 'send' ? (
        <form onSubmit={handleSendCode} className="w-full space-y-4">
          <p className="text-sm text-gray-600">请输入注册邮箱，我们将发送验证码。</p>
          <div>
            <label className="label">邮箱</label>
            <input
              type="email"
              className="input"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="请输入注册邮箱"
              required
            />
          </div>
          {forgotMsg && (
            <div className="bg-blue-50 text-blue-600 text-sm rounded-lg px-4 py-3">{forgotMsg}</div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? '发送中...' : '发送验证码'}
          </button>
          <button type="button" className="w-full text-sm text-gray-400 py-2" onClick={() => setForgotMode('none')}>
            返回登录
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="w-full space-y-4">
          <p className="text-sm text-gray-600">验证码已发送至 <b>{forgotEmail}</b></p>
          <div>
            <label className="label">验证码</label>
            <input
              className="input"
              value={resetCode}
              onChange={e => setResetCode(e.target.value)}
              placeholder="请输入6位验证码"
              required
              maxLength={6}
            />
          </div>
          <div>
            <label className="label">新密码</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              required
              minLength={6}
            />
          </div>
          {forgotMsg && (
            <div className={`text-sm rounded-lg px-4 py-3 ${forgotMsg.includes('成功') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {forgotMsg}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? '重置中...' : '重置密码'}
          </button>
          <button type="button" className="w-full text-sm text-gray-400 py-2" onClick={() => setForgotMode('none')}>
            返回登录
          </button>
        </form>
      )}
    </div>
  );
}
