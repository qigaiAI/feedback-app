import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary-600 mb-2">课后反馈助手</h1>
        <p className="text-gray-500 text-sm">30秒生成专业课后反馈</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {isRegister && (
          <div>
            <label className="label">姓名</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入姓名"
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

        <button
          type="button"
          className="w-full text-sm text-primary-600 py-2"
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
        >
          {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
        </button>
      </form>
    </div>
  );
}
