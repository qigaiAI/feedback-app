import { useState, useEffect } from 'react';

const API = '/api/admin';

export default function AdminPage() {
  const [key, setKey] = useState(() => {
    try { return localStorage.getItem('admin_key') || ''; } catch { return ''; }
  });
  const [tab, setTab] = useState<'users' | 'messages' | 'keys'>('users');
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#333');

  const showMsg = (text: string, color = '#333') => {
    setMsg(text);
    setMsgColor(color);
  };

  const saveKey = (k: string) => {
    setKey(k);
    try { localStorage.setItem('admin_key', k); } catch { /* ignore */ }
  };

  return (
    <div className="px-4 py-4 min-h-screen">
      <h1 className="text-lg font-bold mb-1">管理后台</h1>
      <p className="text-xs text-gray-400 mb-3">直接输入 Admin Key 即可操作，无需登录</p>

      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          type="password"
          placeholder="Admin Key"
          value={key}
          onChange={e => saveKey(e.target.value)}
        />
        <button onClick={() => {}} className="btn-primary text-sm">加载</button>
      </div>

      {msg && (
        <div className="text-sm mb-3 px-2" style={{ color: msgColor }}>{msg}</div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {([
          ['users', '用户管理'],
          ['messages', '用户留言'],
          ['keys', '升级密钥'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setTab(k); setMsg(''); }}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === k ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab key_={key} showMsg={showMsg} />}
      {tab === 'messages' && <MessagesTab key_={key} showMsg={showMsg} />}
      {tab === 'keys' && <KeysTab key_={key} showMsg={showMsg} />}
    </div>
  );
}

function headers(key: string) {
  return { 'X-Admin-Key': key, 'Content-Type': 'application/json' };
}

function UsersTab({ key_, showMsg }: { key_: string; showMsg: (t: string, c?: string) => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!key_) { showMsg('请输入 Admin Key', 'red'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/users`, { headers: headers(key_) });
      const data = await r.json();
      if (data.error) { showMsg(data.error, 'red'); return; }
      showMsg(`共 ${data.users.length} 个用户`);
      setUsers(data.users);
    } catch { showMsg('网络错误', 'red'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (key_) load(); }, [key_]);

  const verifyUser = async (id: string, verified: boolean) => {
    if (!confirm(`确认${verified ? '手动验证' : '取消验证'}？`)) return;
    try {
      const r = await fetch(`${API}/users/${id}/verify`, {
        method: 'PUT', headers: headers(key_),
        body: JSON.stringify({ verified }),
      });
      const data = await r.json();
      if (data.error) { showMsg(data.error, 'red'); return; }
      showMsg('操作成功', 'green');
      load();
    } catch { showMsg('网络错误', 'red'); }
  };

  const showCode = async (id: string) => {
    try {
      const r = await fetch(`${API}/users/${id}/code`, { headers: headers(key_) });
      const data = await r.json();
      if (data.error) { showMsg(data.error, 'red'); return; }
      const exp = data.verification_token_expires ? new Date(data.verification_token_expires).toLocaleString('zh-CN') : '无';
      showMsg(`验证码: <b>${data.verification_token || '无'}</b> (过期: ${exp})`, 'green');
    } catch { showMsg('网络错误', 'red'); }
  };

  const delUser = async (id: string, email: string) => {
    if (!confirm(`确定删除 ${email}？`)) return;
    try {
      const r = await fetch(`${API}/users/${id}`, { method: 'DELETE', headers: headers(key_) });
      const data = await r.json();
      if (data.error) { showMsg(data.error, 'red'); return; }
      showMsg('已删除', 'green');
      load();
    } catch { showMsg('网络错误', 'red'); }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>;
  if (users.length === 0) return <div className="text-center py-8 text-gray-400">暂无数据</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs bg-white rounded-lg overflow-hidden border border-gray-100">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2">邮箱</th><th className="p-2">昵称</th><th className="p-2">验证</th><th className="p-2">注册时间</th><th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.id} className="border-t border-gray-50">
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.name}</td>
              <td className="p-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                  u.email_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {u.email_verified ? '已验证' : '未验证'}
                </span>
              </td>
              <td className="p-2">{new Date(u.created_at).toLocaleString('zh-CN')}</td>
              <td className="p-2">
                <div className="flex gap-1 flex-wrap">
                  {!u.email_verified && (
                    <button onClick={() => verifyUser(u.id, true)} className="text-xs text-primary-600 px-1">验证</button>
                  )}
                  <button onClick={() => showCode(u.id)} className="text-xs text-gray-500 px-1">验证码</button>
                  <button onClick={() => delUser(u.id, u.email)} className="text-xs text-red-400 px-1">删除</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesTab({ key_, showMsg }: { key_: string; showMsg: (t: string, c?: string) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!key_) { showMsg('请输入 Admin Key', 'red'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/messages`, { headers: headers(key_) });
      const data = await r.json();
      if (data.error) { showMsg(data.error, 'red'); return; }
      showMsg(`共 ${data.messages.length} 条留言`);
      setMessages(data.messages);
    } catch { showMsg('网络错误', 'red'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (key_) load(); }, [key_]);

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>;
  if (messages.length === 0) return <div className="text-center py-8 text-gray-400">暂无留言</div>;

  return (
    <div className="space-y-3">
      {messages.map((m: any) => (
        <div key={m.id} className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-xs text-gray-400 mb-1">
            {m.name} ({m.email}) · {new Date(m.created_at).toLocaleString('zh-CN')}
          </div>
          <div className="text-sm whitespace-pre-wrap">{m.content}</div>
        </div>
      ))}
    </div>
  );
}

function KeysTab({ key_, showMsg }: { key_: string; showMsg: (t: string, c?: string) => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(5);

  const load = async () => {
    if (!key_) { showMsg('请输入 Admin Key', 'red'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/upgrade-keys`, { headers: headers(key_) });
      const data = await r.json();
      if (data.error) { showMsg(data.error, 'red'); return; }
      showMsg(`共 ${data.keys.length} 个密钥`);
      setKeys(data.keys);
    } catch { showMsg('网络错误', 'red'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (key_) load(); }, [key_]);

  const genKeys = async () => {
    if (!key_) { showMsg('请输入 Admin Key', 'red'); return; }
    try {
      const r = await fetch(`${API}/upgrade-keys/generate`, {
        method: 'POST', headers: headers(key_),
        body: JSON.stringify({ count }),
      });
      const data = await r.json();
      if (data.error) { showMsg(data.error, 'red'); return; }
      showMsg(`已生成 ${data.keys.length} 个密钥`, 'green');
      load();
    } catch { showMsg('网络错误', 'red'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input
          className="input w-20"
          type="number"
          min={1} max={50}
          value={count}
          onChange={e => setCount(parseInt(e.target.value) || 5)}
        />
        <button onClick={genKeys} className="btn-primary text-sm">生成密钥</button>
        <button onClick={load} className="btn-secondary text-sm">刷新</button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 text-gray-400">暂无密钥</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs bg-white rounded-lg overflow-hidden border border-gray-100">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">密钥</th><th className="p-2">状态</th><th className="p-2">使用者</th><th className="p-2">使用时间</th><th className="p-2">生成时间</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k: any) => (
                <tr key={k.id} className="border-t border-gray-50">
                  <td className="p-2 font-mono text-xs">{k.key}</td>
                  <td className="p-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      k.used_by ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {k.used_by ? '已使用' : '未使用'}
                    </span>
                  </td>
                  <td className="p-2">{k.used_by_name ? `${k.used_by_name} (${k.used_by_email})` : '-'}</td>
                  <td className="p-2">{k.used_at ? new Date(k.used_at).toLocaleString('zh-CN') : '-'}</td>
                  <td className="p-2">{new Date(k.created_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
