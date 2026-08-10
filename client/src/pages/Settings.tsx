import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Loading from '../components/Loading';

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [editingNickname, setEditingNickname] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    setNickname(user?.nickname || '');
  }, [user?.nickname]);

  const saveNickname = async () => {
    try {
      const res = await api.put('/api/auth/profile', { nickname: nickname.trim() || null });
      setNickname(res.data.user.nickname || '');
      await refreshUser();
      setEditingNickname(false);
      setSaveMsg('已保存');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch { alert('保存失败'); }
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">设置</h2>
        <button onClick={logout} className="text-sm text-red-500">退出登录</button>
      </div>

      <div className="text-sm text-gray-500 mb-4">
        {user?.nickname && <span>{user.nickname} · </span>}{user?.name} · {user?.email}
      </div>

      <div className="card mb-4">
        <p className="label mb-1">授课老师昵称</p>
        <p className="text-xs text-gray-400 mb-2">此昵称会显示在课后反馈中的"授课老师"处。</p>
        {editingNickname ? (
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="如：王老师"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              autoFocus
            />
            <button onClick={saveNickname} className="btn-primary text-sm">
              {saveMsg || '保存'}
            </button>
            <button onClick={() => { setEditingNickname(false); setNickname(user?.nickname || ''); }} className="btn-secondary text-sm">
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm">{user?.nickname || <span className="text-gray-400">未设置</span>}</span>
            <button onClick={() => setEditingNickname(true)} className="text-sm text-primary-600">修改</button>
          </div>
        )}
        {saveMsg && !editingNickname && (
          <p className="text-xs text-green-600 mt-1">{saveMsg}</p>
        )}
      </div>

      <div className="mb-4">
        <h3 className="font-medium text-sm mb-3">课堂表现标签</h3>
        <BehaviorTab />
      </div>

      <div className="border-t pt-4 mb-4">
        <FeedbackForm />
      </div>

      <div className="border-t pt-4">
        <p className="text-xs text-gray-400">
          风格模板请前往「模板」页面管理。知识内容已改为写反馈时自由填写。
        </p>
      </div>
    </div>
  );
}

function FeedbackForm() {
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      await api.post('/api/messages', { content: content.trim() });
      setSubmitted(true);
      setContent('');
    } catch { alert('提交失败'); }
    finally { setSending(false); }
  };

  if (submitted) {
    return (
      <div className="text-sm text-green-600 text-center py-2">
        感谢您的反馈！我们会认真阅读每一条留言。
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-medium text-sm mb-2">留言给作者</h3>
      <p className="text-xs text-gray-400 mb-2">您对产品的改进意见、功能需求或 bug 反馈，欢迎告诉我们。</p>
      <textarea
        className="input min-h-[100px]"
        placeholder="请写下您的想法..."
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      <button
        onClick={submit}
        className="btn-primary w-full mt-2"
        disabled={sending || !content.trim()}
      >
        {sending ? '提交中...' : '提交'}
      </button>
    </div>
  );
}

function BehaviorTab() {
  const [tags, setTags] = useState<{ id: string; name: string; teacher_id: string | null }[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTags = () => {
    api.get('/api/tags/behavior')
      .then(r => setTags(r.data.tags))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTags(); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    try { await api.post('/api/tags/behavior', { name: newName }); setNewName(''); fetchTags(); }
    catch { alert('添加失败'); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/api/tags/behavior/${id}`); fetchTags(); }
    catch { alert('删除失败'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="新标签名称" value={newName} onChange={e => setNewName(e.target.value)} />
        <button onClick={add} className="btn-primary">添加</button>
      </div>
      <div className="space-y-2">
        {tags.map(t => (
          <div key={t.id} className="card flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{t.name}</span>
              {!t.teacher_id && <span className="text-xs text-gray-400">(系统)</span>}
            </div>
            <button onClick={() => remove(t.id)} className="text-sm text-red-400">删除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
