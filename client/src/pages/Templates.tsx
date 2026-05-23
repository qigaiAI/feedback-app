import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Loading from '../components/Loading';

interface Template {
  id: string;
  name: string;
  style_prompt: string;
  is_default: boolean;
  created_at: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [samples, setSamples] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [stylePrompt, setStylePrompt] = useState('');
  const [previewDesc, setPreviewDesc] = useState('');
  const [previewResult, setPreviewResult] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    try {
      const r = await api.get('/api/templates');
      setTemplates(r.data.templates);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const resetWizard = () => {
    setStep(1);
    setSamples('');
    setStylePrompt('');
    setPreviewDesc('');
    setPreviewResult('');
    setTemplateName('');
    setIsDefault(false);
    setEditingTemplate(null);
  };

  const openNew = () => {
    if (templates.length >= 3) {
      alert('最多保存3个模板，请先删除一个');
      return;
    }
    resetWizard();
    setShowWizard(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setStylePrompt(t.style_prompt);
    setTemplateName(t.name);
    setIsDefault(t.is_default);
    setStep(2);
    setShowWizard(true);
  };

  const analyze = async () => {
    if (!samples.trim()) return;
    setAnalyzing(true);
    try {
      const r = await api.post('/api/template/analyze-style', { samples: [samples.trim()] });
      setStylePrompt(r.data.instruction);
      setStep(2);
    } catch { alert('分析失败，请重试'); }
    finally { setAnalyzing(false); }
  };

  const doPreview = async () => {
    if (!stylePrompt || !previewDesc) return;
    setPreviewing(true);
    try {
      const r = await api.post('/api/template/preview-style', { prompt: stylePrompt, test_description: previewDesc });
      setPreviewResult(r.data.preview);
    } catch { alert('预览失败'); }
    finally { setPreviewing(false); }
  };

  const save = async () => {
    if (!templateName.trim() || !stylePrompt.trim()) {
      alert('请填写模板名称和风格指令');
      return;
    }
    setSaving(true);
    try {
      if (editingTemplate) {
        await api.put(`/api/templates/${editingTemplate.id}`, {
          name: templateName,
          style_prompt: stylePrompt,
          is_default: isDefault,
        });
      } else {
        await api.post('/api/templates', {
          name: templateName,
          style_prompt: stylePrompt,
          is_default: isDefault,
        });
      }
      setShowWizard(false);
      resetWizard();
      await fetchTemplates();
    } catch (err: any) {
      alert(err.response?.data?.error || '保存失败');
    }
    finally { setSaving(false); }
  };

  const del = async (t: Template) => {
    if (!confirm(`确定删除模板"${t.name}"？`)) return;
    try {
      await api.delete(`/api/templates/${t.id}`);
      fetchTemplates();
    } catch { alert('删除失败'); }
  };

  const setDefault = async (id: string) => {
    try {
      await api.put(`/api/templates/${id}/default`);
      fetchTemplates();
    } catch { alert('设置失败'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-1">模板制作</h2>
      <p className="text-xs text-gray-400 mb-4">AI 风格模板决定了反馈的语气和格式，最多保存 3 个</p>

      {!showWizard ? (
        <>
          {/* Template list */}
          <div className="space-y-3 mb-4">
            {templates.map(t => (
              <div key={t.id} className={`card ${t.is_default ? 'ring-2 ring-primary-300' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  <div className="flex gap-2">
                    {!t.is_default && (
                      <button onClick={() => setDefault(t.id)} className="text-xs text-primary-500">设为默认</button>
                    )}
                    {t.is_default && <span className="text-xs text-primary-400">默认</span>}
                    <button onClick={() => openEdit(t)} className="text-xs text-gray-500">编辑</button>
                    <button onClick={() => del(t)} className="text-xs text-red-400">删除</button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 whitespace-pre-wrap">{t.style_prompt}</p>
              </div>
            ))}
            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">还没有模板</p>
                <p className="text-xs mt-1">点击下方按钮创建你的第一个风格模板</p>
              </div>
            )}
          </div>

          <button onClick={openNew} className="btn-primary w-full" disabled={templates.length >= 3}>
            {templates.length >= 3 ? '已达上限（3个）' : '+ 新建模板'}
          </button>
        </>
      ) : (
        <>
          {/* Back */}
          <button onClick={() => { setShowWizard(false); resetWizard(); }} className="text-sm text-primary-600 mb-4">
            &larr; 返回模板列表
          </button>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  step >= s ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 text-xs text-gray-400 mb-4">
            <span className={step === 1 ? 'text-primary-600 font-medium' : ''}>学习风格</span>
            <span className={step === 2 ? 'text-primary-600 font-medium' : ''}>编辑指令</span>
            <span className={step === 3 ? 'text-primary-600 font-medium' : ''}>预览保存</span>
          </div>

          {/* Step 1: Learn from history */}
          {step === 1 && (
            <div className="card space-y-3">
              <p className="text-sm font-medium">第一步：从历史反馈学习风格</p>
              <p className="text-xs text-gray-500">粘贴一段你的历史反馈文本，AI 将分析你的写作风格并生成初始指令。</p>
              <textarea
                className="input min-h-[150px]"
                placeholder="粘贴历史反馈样本..."
                value={samples}
                onChange={e => setSamples(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                也可以跳过此步骤，直接手动编写风格指令。
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setStep(2); }} className="btn-secondary flex-1">
                  跳过，手动编写
                </button>
                <button onClick={analyze} className="btn-primary flex-1" disabled={analyzing || !samples.trim()}>
                  {analyzing ? '分析中...' : '分析并生成'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Edit style prompt */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="card space-y-2">
                <p className="text-sm font-medium">第二步：编辑风格指令</p>
                <p className="text-xs text-gray-500">这是 AI 在生成反馈时遵循的"人格指令"。包含称呼、语气、格式、结构等。</p>
                <textarea
                  className="input min-h-[200px] font-mono text-xs"
                  value={stylePrompt}
                  onChange={e => setStylePrompt(e.target.value)}
                  placeholder="输入 AI 风格指令..."
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">&larr; 上一步</button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1" disabled={!stylePrompt.trim()}>
                  下一步：预览 &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Save */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="card space-y-3">
                <p className="text-sm font-medium">第三步：预览效果并保存</p>
                <input
                  className="input"
                  placeholder="输入测试描述，如：小明今天学会了分数加减法"
                  value={previewDesc}
                  onChange={e => setPreviewDesc(e.target.value)}
                />
                <button onClick={doPreview} className="btn-primary w-full" disabled={previewing || !previewDesc}>
                  {previewing ? '生成中...' : '生成预览'}
                </button>
                {previewResult && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap border">{previewResult}</div>
                )}
              </div>

              <div className="card space-y-3">
                <p className="text-sm font-medium">保存模板</p>
                <input
                  className="input"
                  placeholder="模板名称（如：温柔鼓励型）"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={e => setIsDefault(e.target.checked)}
                    className="w-4 h-4"
                  />
                  设为默认模板（写反馈时自动选择）
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="btn-secondary flex-1">&larr; 上一步</button>
                  <button onClick={save} className="btn-primary flex-1" disabled={saving || !templateName.trim()}>
                    {saving ? '保存中...' : editingTemplate ? '更新模板' : '保存模板'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
