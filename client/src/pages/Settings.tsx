import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Loading from '../components/Loading';

export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">设置</h2>
        <button onClick={logout} className="text-sm text-red-500">退出登录</button>
      </div>

      <div className="text-sm text-gray-500 mb-4">
        {user?.name} · {user?.email}
      </div>

      <div className="mb-4">
        <h3 className="font-medium text-sm mb-3">行为标签管理</h3>
        <BehaviorTab />
      </div>

      <div className="border-t pt-4">
        <p className="text-xs text-gray-400">
          风格模板请前往「模板」页面管理。知识内容已改为写反馈时自由填写。
        </p>
      </div>
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
