import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import Loading from '../components/Loading';

export default function Settings() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'style' | 'behavior' | 'knowledge'>('style');

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">设置</h2>
        <button onClick={logout} className="text-sm text-red-500">退出登录</button>
      </div>

      <div className="text-sm text-gray-500 mb-4">
        {user?.name} · {user?.email}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {[
          { k: 'style' as const, l: '风格指令' },
          { k: 'behavior' as const, l: '行为标签' },
          { k: 'knowledge' as const, l: '知识标签' },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === t.k ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'style' && <StyleTab />}
      {tab === 'behavior' && <BehaviorTab />}
      {tab === 'knowledge' && <KnowledgeTab />}
    </div>
  );
}

function StyleTab() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [samples, setSamples] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [previewDesc, setPreviewDesc] = useState('');
  const [previewResult, setPreviewResult] = useState('');
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    api.get('/api/template/style-prompt')
      .then(r => setPrompt(r.data.style_prompt || ''))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try { await api.put('/api/template/style-prompt', { prompt }); alert('已保存'); }
    catch { alert('保存失败'); }
    finally { setSaving(false); }
  };

  const analyze = async () => {
    if (!samples.trim()) return;
    setAnalyzing(true);
    try {
      const sampleList = samples.split(/【.+?】/).filter(Boolean).map(s => s.trim()).filter(s => s.length > 10);
      if (sampleList.length === 0) {
        const r = await api.post('/api/template/analyze-style', { samples: [samples.trim()] });
        setPrompt(r.data.instruction);
      } else {
        const r = await api.post('/api/template/analyze-style', { samples: sampleList });
        setPrompt(r.data.instruction);
      }
      alert('风格分析完成，指令已生成到编辑框中');
    } catch { alert('分析失败'); }
    finally { setAnalyzing(false); }
  };

  const preview = async () => {
    if (!prompt || !previewDesc) return;
    setPreviewing(true);
    try {
      const r = await api.post('/api/template/preview-style', { prompt, test_description: previewDesc });
      setPreviewResult(r.data.preview);
    } catch { alert('预览失败'); }
    finally { setPreviewing(false); }
  };

  const reset = async () => {
    if (!confirm('确定重置为默认风格指令？')) return;
    await api.put('/api/template/style-prompt', { prompt: '' });
    setPrompt('');
    alert('已重置');
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="label">AI 风格指令</p>
          <div className="flex gap-2">
            <button onClick={reset} className="text-xs text-red-500">重置默认</button>
            <button onClick={save} className="text-xs text-primary-600" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
        <textarea
          className="input min-h-[150px] font-mono text-xs"
          placeholder="未设置风格指令时使用默认风格..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
      </div>

      {/* Preview */}
      <div className="card space-y-3">
        <p className="label">预览风格效果</p>
        <input
          className="input"
          placeholder="输入测试描述，如：小明今天学会了分数加减法，认真听讲"
          value={previewDesc}
          onChange={e => setPreviewDesc(e.target.value)}
        />
        <button onClick={preview} className="btn-primary w-full" disabled={previewing || !prompt || !previewDesc}>
          {previewing ? '生成预览...' : '预览'}
        </button>
        {previewResult && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{previewResult}</div>
        )}
      </div>

      {/* Analyze */}
      <div className="card space-y-3">
        <p className="label">从历史反馈学习风格</p>
        <p className="text-xs text-gray-500">粘贴多段历史反馈文本，AI 将分析您的写作风格并生成指令。</p>
        <textarea
          className="input min-h-[120px]"
          placeholder="粘贴您的历史反馈样本..."
          value={samples}
          onChange={e => setSamples(e.target.value)}
        />
        <button onClick={analyze} className="btn-primary w-full" disabled={analyzing || !samples.trim()}>
          {analyzing ? '分析中...' : '分析并生成风格指令'}
        </button>
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
    catch { alert('只能删除自定义标签'); }
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
            {t.teacher_id && (
              <button onClick={() => remove(t.id)} className="text-sm text-red-400">删除</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function KnowledgeTab() {
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState('');
  const [level3Tags, setLevel3Tags] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/tags/knowledge')
      .then(r => {
        setTags(r.data.tags);
        setLevel3Tags(r.data.tags.filter((t: any) => t.level === 3));
      })
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!newName.trim() || !parentId) return;
    try {
      await api.post('/api/tags/knowledge', { name: newName, parent_id: parentId });
      setNewName('');
      // Refresh
      const r = await api.get('/api/tags/knowledge');
      setTags(r.data.tags);
      setLevel3Tags(r.data.tags.filter((t: any) => t.level === 3));
    } catch { alert('添加失败'); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/api/tags/knowledge/${id}`); const r = await api.get('/api/tags/knowledge'); setTags(r.data.tags); }
    catch { alert('只能删除自定义标签'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-sm font-medium">添加自定义知识点</p>
        <select className="input" value={parentId} onChange={e => setParentId(e.target.value)}>
          <option value="">选择专题</option>
          {level3Tags.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="知识点名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <button onClick={add} className="btn-primary" disabled={!newName || !parentId}>添加</button>
        </div>
      </div>
    </div>
  );
}
