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

interface Feedback {
  id: string;
  content: string;
  student_name: string;
  created_at: string;
}

const STYLE_OPTIONS = [
  { key: 'warm', label: '语气亲切', text: '使用温暖亲切的语气，让学生和家长感到关怀。' },
  { key: 'progress', label: '突出进步点', text: '重点强调学生相比之前的进步和成长。' },
  { key: 'gentle', label: '委婉指出不足', text: '在表扬之后，以建议的方式委婉提及需要改进的地方。' },
  { key: 'praise_first', label: '先表扬后建议', text: '每个段落先肯定优点，再给出建设性建议。' },
  { key: 'concise', label: '简洁高效', text: '控制字数，直击要点，避免冗长。' },
  { key: 'emoji', label: '适当使用表情', text: '在合适的位置使用 emoji 增强亲和力。' },
];

const MOCK_STUDENT = '小明，三年级，本节课学习分数加减法。专注度4星，正确率3星，基本掌握。积极发言，作业完成优秀。';

function buildStyleFromOptions(selected: string[]): string {
  if (selected.length === 0) return '';
  const base = '你是一位专业的课后反馈撰写助手。请按以下风格要求生成反馈：\n';
  const rules = selected
    .map(k => STYLE_OPTIONS.find(o => o.key === k))
    .filter(Boolean)
    .map(o => `- ${o!.text}`);
  return base + rules.join('\n') + '\n\n严格基于提供的评价数据，不编造任何信息。';
}

const EXAMPLE_TEMPLATE: Template = {
  id: '__example__',
  name: '专业鼓励型（示例）',
  style_prompt: '你是一位富有经验的教育工作者。在写反馈时：先肯定学生的努力和进步，用具体的课堂表现作为例子；然后委婉地指出1-2个可以继续提高的地方，附带具体建议；最后给予温暖的鼓励。语气真诚、专业、有温度。每段反馈约150-200字。',
  is_default: false,
  created_at: '',
};

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [learnMode, setLearnMode] = useState<'select' | 'paste'>('select');
  const [samples, setSamples] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [previewDesc, setPreviewDesc] = useState(MOCK_STUDENT);
  const [previewResult, setPreviewResult] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const fetchTemplates = async () => {
    try {
      const [tRes, fRes] = await Promise.all([
        api.get('/api/templates'),
        api.get('/api/feedbacks/history?limit=50'),
      ]);
      setTemplates(tRes.data.templates);
      setFeedbacks(fRes.data.feedbacks || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const resetWizard = () => {
    setStep(1);
    setSelectedFeedbackIds(new Set());
    setStylePrompt('');
    setSelectedStyles(new Set());
    setPreviewDesc(MOCK_STUDENT);
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
    // Detect which styles match
    const matched = new Set<string>();
    STYLE_OPTIONS.forEach(o => {
      if (t.style_prompt.includes(o.text)) matched.add(o.key);
    });
    setSelectedStyles(matched);
    setStep(2);
    setShowWizard(true);
  };

  const toggleStyle = (key: string) => {
    setSelectedStyles(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // When styles change, auto-combine into prompt
  useEffect(() => {
    const combined = buildStyleFromOptions([...selectedStyles]);
    if (combined) setStylePrompt(combined);
  }, [selectedStyles]);

  const analyzeFromFeedbacks = async () => {
    if (selectedFeedbackIds.size < 2) {
      alert('请选择至少2条历史反馈');
      return;
    }
    setAnalyzing(true);
    try {
      const sampleTexts = feedbacks
        .filter(f => selectedFeedbackIds.has(f.id))
        .map(f => f.content);
      const r = await api.post('/api/template/analyze-style', { samples: sampleTexts });
      setStylePrompt(r.data.instruction);
      setStep(2);
    } catch { alert('分析失败，请重试'); }
    finally { setAnalyzing(false); }
  };

  const analyzeFromPaste = async () => {
    if (!samples.trim() || samples.trim().length < 20) {
      alert('请粘贴至少20字的反馈样本');
      return;
    }
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
    try { await api.delete(`/api/templates/${t.id}`); fetchTemplates(); }
    catch { alert('删除失败'); }
  };

  const setDefault = async (id: string) => {
    try { await api.put(`/api/templates/${id}/default`); fetchTemplates(); }
    catch { alert('设置失败'); }
  };

  const useExample = () => {
    setStylePrompt(EXAMPLE_TEMPLATE.style_prompt);
    setTemplateName(EXAMPLE_TEMPLATE.name);
    setStep(2);
    setShowWizard(true);
  };

  const toggleFeedback = (id: string) => {
    setSelectedFeedbackIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  if (loading) return <Loading />;

  const showExample = templates.length === 0 && !showWizard;

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-1">模板制作</h2>
      <p className="text-xs text-gray-400 mb-3">AI 风格模板决定了反馈的语气和格式，最多保存 3 个</p>

      {/* Feature intro card */}
      <div className="mb-4">
        <button
          onClick={() => setShowIntro(!showIntro)}
          className="flex items-center gap-1 text-sm text-primary-600 mb-2"
        >
          <span>{showIntro ? '▾' : '▸'}</span>
          {showIntro ? '收起' : '了解模板好处'}
        </button>
        {showIntro && (
          <div className="card bg-gradient-to-br from-blue-50 to-white border-blue-200 space-y-3 text-sm">
            <div>
              <p className="font-medium text-blue-800">📝 什么是模板？</p>
              <p className="text-xs text-gray-600 mt-1">模板就是您写反馈的写作风格。每次生成反馈时，AI 会按照您选择的模板来组织语言、调整语气。</p>
            </div>
            <div>
              <p className="font-medium text-blue-800">✨ 模板能帮您做什么？</p>
              <ul className="text-xs text-gray-600 mt-1 space-y-1">
                <li>• <b>保持风格一致</b>：每次反馈读起来都像您亲手写的</li>
                <li>• <b>节省时间</b>：不用每次重复告诉 AI "语气温柔一点"、"先说优点再说不足"</li>
                <li>• <b>从历史中学习</b>：您可以把之前写过的几条优秀反馈贴进来，AI 会分析您的写作习惯，自动生成一个符合您风格的模板</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-blue-800">🎯 如何制作？</p>
              <ol className="text-xs text-gray-600 mt-1 space-y-0.5 list-decimal list-inside">
                <li>让 AI 学习您的历史反馈（可选）→ 粘贴几条您自己写的反馈，AI 提取风格</li>
                <li>编辑风格指令（可自由修改）</li>
                <li>预览效果 → 输入一段测试表现，看看生成的反馈是否符合预期</li>
                <li>保存为模板（最多3个）</li>
              </ol>
            </div>
            <p className="text-xs text-primary-500 font-medium">开始制作您的第一个模板吧 👇</p>
          </div>
        )}
      </div>

      {!showWizard ? (
        <>
          {/* Example template card */}
          {showExample && (
            <div className="card mb-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-blue-800">{EXAMPLE_TEMPLATE.name}</span>
                <span className="text-xs text-blue-400">示例</span>
              </div>
              <p className="text-xs text-blue-600 whitespace-pre-wrap mb-3 line-clamp-3">{EXAMPLE_TEMPLATE.style_prompt}</p>
              <div className="bg-white rounded-lg p-3 text-xs text-gray-600 mb-3 italic">
                "小明同学今天表现非常棒！在分数加减法的练习中，你的专注度让老师印象深刻..."
              </div>
              <div className="flex gap-2">
                <button onClick={useExample} className="btn-primary text-sm flex-1">使用此模板</button>
                <button onClick={openNew} className="btn-secondary text-sm flex-1">自定义模板</button>
              </div>
            </div>
          )}

          {/* Existing templates */}
          {templates.length > 0 && (
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
            </div>
          )}

          <button onClick={openNew} className="btn-primary w-full" disabled={templates.length >= 3}>
            {templates.length >= 3 ? '已达上限（3个）' : '+ 新建模板'}
          </button>
        </>
      ) : (
        <>
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

          {/* Step 1: Learn from feedbacks or paste */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Mode tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setLearnMode('select')}
                  className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                    learnMode === 'select' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
                  }`}
                >
                  选择历史反馈
                </button>
                <button
                  onClick={() => setLearnMode('paste')}
                  className={`px-4 py-2 text-sm border-b-2 -mb-px ${
                    learnMode === 'paste' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
                  }`}
                >
                  手动粘贴
                </button>
              </div>

              {learnMode === 'select' && (
                <div className="card space-y-3">
                  <p className="text-xs text-gray-500">选择 2-4 条历史反馈，AI 将分析共同特点生成风格指令。</p>
                  {feedbacks.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">暂无历史反馈，请切换到"手动粘贴"模式。</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {feedbacks.slice(0, 20).map(f => (
                        <button
                          key={f.id}
                          onClick={() => toggleFeedback(f.id)}
                          className={`w-full text-left p-3 rounded-lg border text-xs ${
                            selectedFeedbackIds.has(f.id)
                              ? 'bg-primary-50 border-primary-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{f.student_name}</span>
                            <span className="text-gray-400">{new Date(f.created_at).toLocaleDateString('zh-CN')}</span>
                          </div>
                          <p className="text-gray-600 line-clamp-2">{f.content}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">已选 {selectedFeedbackIds.size}/4 条</p>
                  <button
                    onClick={analyzeFromFeedbacks}
                    className="btn-primary w-full"
                    disabled={analyzing || selectedFeedbackIds.size < 2}
                  >
                    {analyzing ? '分析中...' : `分析风格 (${selectedFeedbackIds.size}条)`}
                  </button>
                </div>
              )}

              {learnMode === 'paste' && (
                <div className="card space-y-3">
                  <p className="text-xs text-gray-500">粘贴一段或多段你的历史反馈文本，AI 将分析写作风格。</p>
                  <textarea
                    className="input min-h-[150px]"
                    placeholder="粘贴历史反馈样本...&#10;&#10;可以粘贴一条或多条，AI 会自动分析风格特点。"
                    value={samples}
                    onChange={e => setSamples(e.target.value)}
                  />
                  <button
                    onClick={analyzeFromPaste}
                    className="btn-primary w-full"
                    disabled={analyzing || samples.trim().length < 20}
                  >
                    {analyzing ? '分析中...' : '分析风格'}
                  </button>
                </div>
              )}

              <button onClick={() => setStep(2)} className="btn-secondary w-full">
                跳过学习，手动编写风格指令
              </button>
            </div>
          )}

          {/* Step 2: Edit style prompt with checkbox options */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Style checkboxes */}
              <div className="card space-y-2">
                <p className="text-sm font-medium">快速风格选项</p>
                <p className="text-xs text-gray-500">勾选后自动生成风格指令，也可直接在下方手动修改。</p>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => toggleStyle(opt.key)}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        selectedStyles.has(opt.key)
                          ? 'bg-primary-100 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card space-y-2">
                <p className="text-sm font-medium">风格指令编辑</p>
                <p className="text-xs text-gray-500">您可以在此修改指令，让 AI 按您的要求生成反馈。</p>
                <textarea
                  className="input min-h-[200px] font-mono text-xs"
                  value={stylePrompt}
                  onChange={e => setStylePrompt(e.target.value)}
                  placeholder="输入 AI 风格指令..."
                />
              </div>

              {/* Quick preview button */}
              <button
                onClick={async () => {
                  if (!stylePrompt) return;
                  setPreviewing(true);
                  try {
                    const r = await api.post('/api/template/preview-style', {
                      prompt: stylePrompt,
                      test_description: MOCK_STUDENT,
                    });
                    setPreviewResult(r.data.preview);
                  } catch { alert('预览失败'); }
                  finally { setPreviewing(false); }
                }}
                className="btn-secondary w-full text-sm"
                disabled={previewing || !stylePrompt}
              >
                {previewing ? '生成中...' : '按当前风格生成示例预览'}
              </button>
              {previewResult && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap border">{previewResult}</div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">&larr; 上一步</button>
                <button onClick={() => { setStep(3); setPreviewResult(''); }} className="btn-primary flex-1" disabled={!stylePrompt.trim()}>
                  下一步 &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Save */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="card space-y-3">
                <p className="text-sm font-medium">第三步：预览效果并保存</p>
                <textarea
                  className="input min-h-[80px] text-sm"
                  placeholder="输入测试描述..."
                  value={previewDesc}
                  onChange={e => setPreviewDesc(e.target.value)}
                />
                <button onClick={doPreview} className="btn-primary w-full" disabled={previewing || !previewDesc}>
                  {previewing ? '生成中...' : '生成预览'}
                </button>
                {previewResult && (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap border min-h-[200px]">{previewResult}</div>
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
                  <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4" />
                  设为默认模板
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
