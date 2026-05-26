import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import StarRating from '../components/StarRating';
import Loading from '../components/Loading';

interface Student {
  id: string;
  name: string;
  grade: string | null;
  notes: string | null;
  groups: { id: string; name: string }[];
}

interface Group {
  id: string;
  name: string;
  student_count: number;
}

interface BehaviorTag {
  id: string;
  name: string;
  teacher_id: string | null;
}

interface Template {
  id: string;
  name: string;
  style_prompt: string;
  is_default: boolean;
}

interface DimensionEval {
  progress?: string;
  current?: string;
}

interface StudentEval {
  student_id: string;
  student_name: string;
  student_grade: string | null;
  student_notes: string | null;
  focus?: number;
  accuracy?: number;
  participation: DimensionEval;
  thinking: DimensionEval;
  habits: DimensionEval;
  knowledge_depth: DimensionEval;
  behavior_tags: string[];
  knowledge_text: string;
  extra_comment: string;
  homework: string;
  previous_feedback_id: string | null;
  previous_feedback_text: string;
  lastFeedbackLoaded: boolean;
  lastFeedbackLoading: boolean;
}

const PROGRESS_OPTS = ['有进步', '进步很大', '状态保持', '有所退步', '退步比较明显'];
const CURRENT_OPTS = ['还需提高', '基本达标', '还不错', '非常好', '表现卓越'];
export default function FeedbackNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { returnEvals?: StudentEval[]; returnTemplateId?: string } | null;
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<'select' | 'evaluate' | 'generating'>(
    locationState?.returnEvals ? 'evaluate' : 'select'
  );

  // Student selection
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Evaluation
  const [evals, setEvals] = useState<StudentEval[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inheritContent, setInheritContent] = useState(true);
  const [behaviorTags, setBehaviorTags] = useState<BehaviorTag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const prefilledStudentId = searchParams.get('student');

  // Restore from result page "back to modify"
  useEffect(() => {
    if (locationState?.returnEvals) {
      setEvals(locationState.returnEvals);
      if (locationState.returnTemplateId) {
        setSelectedTemplateId(locationState.returnTemplateId);
      }
      // Clear the location state so it doesn't persist on refresh
      window.history.replaceState({}, '');
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/api/students'),
      api.get('/api/groups'),
      api.get('/api/tags/behavior'),
      api.get('/api/templates'),
    ])
      .then(([sRes, gRes, btRes, tRes]) => {
        setStudents(sRes.data.students);
        setGroups(gRes.data.groups);
        setBehaviorTags(btRes.data.tags);
        setTemplates(tRes.data.templates);
        const def = tRes.data.templates.find((t: Template) => t.is_default);
        if (def) setSelectedTemplateId(def.id);
        if (prefilledStudentId) {
          setSelectedIds(new Set([prefilledStudentId]));
          // Find which class this student belongs to
          const student = sRes.data.students.find((s: Student) => s.id === prefilledStudentId);
          if (student?.groups.length > 0) {
            setSelectedClassId(student.groups[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [prefilledStudentId]);

  // Filter students by selected class
  const filteredStudents = students.filter(s => {
    if (!selectedClassId) return false;
    if (search && !s.name.includes(search)) return false;
    return s.groups.some(g => g.id === selectedClassId);
  });

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedIds(new Set()); // Clear selection on class switch
  };

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInClass = () => {
    const classStudentIds = filteredStudents.map(s => s.id);
    const allSelected = classStudentIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(classStudentIds));
    }
  };

  const startEval = async () => {
    const selected = students.filter(s => selectedIds.has(s.id));
    const evl: StudentEval[] = await Promise.all(
      selected.map(async (s) => {
        // Fetch last feedback for this student
        let prevId: string | null = null;
        let prevText = '';
        let loaded = false;
        let loadingDone = false;
        try {
          const r = await api.get(`/api/feedbacks/last/${s.id}`);
          loadingDone = true;
          if (r.data.feedback) {
            prevId = r.data.feedback.id;
            prevText = r.data.feedback.content;
          }
          loaded = true;
        } catch { loaded = true; }

        return {
          student_id: s.id,
          student_name: s.name,
          student_grade: s.grade,
          student_notes: s.notes,
          behavior_tags: [],
          knowledge_text: '',
          extra_comment: '',
          homework: '',
          previous_feedback_id: prevId,
          previous_feedback_text: prevText,
          lastFeedbackLoaded: loaded,
          lastFeedbackLoading: !loadingDone,
          participation: {},
          thinking: {},
          habits: {},
          knowledge_depth: {},
        };
      })
    );
    setEvals(evl);
    setCurrentIdx(0);
    setPhase('evaluate');
  };

  const updateEval = (idx: number, updates: Partial<StudentEval>) => {
    setEvals(prev => prev.map((e, i) => (i === idx ? { ...e, ...updates } : e)));
  };

  const updateDim = (idx: number, dim: string, field: 'progress' | 'current', value: string | undefined) => {
    setEvals(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const current = (e as any)[dim] || {};
      return { ...e, [dim]: { ...current, [field]: current[field] === value ? undefined : value } };
    }));
  };

  const generate = async () => {
    // Validate required fields
    const emptyKnowledge = evals.findIndex(e => !e.knowledge_text.trim());
    if (emptyKnowledge !== -1) {
      setCurrentIdx(emptyKnowledge);
      alert(`请填写"${evals[emptyKnowledge].student_name}"的本节课学习内容`);
      return;
    }
    setPhase('generating');
    try {
      // Clean evals before sending
      const payload = evals.map(e => ({
        student_id: e.student_id,
        evaluations: {
          focus: e.focus,
          accuracy: e.accuracy,
          participation: e.participation?.progress || e.participation?.current ? e.participation : undefined,
          thinking: e.thinking?.progress || e.thinking?.current ? e.thinking : undefined,
          habits: e.habits?.progress || e.habits?.current ? e.habits : undefined,
          knowledge_depth: e.knowledge_depth?.progress || e.knowledge_depth?.current ? e.knowledge_depth : undefined,
        },
        behavior_tags: e.behavior_tags.length > 0 ? e.behavior_tags : undefined,
        knowledge_text: e.knowledge_text || undefined,
        extra_comment: e.extra_comment || undefined,
        homework: e.homework || undefined,
        previous_feedback_id: e.previous_feedback_id || undefined,
        previous_feedback_text: e.previous_feedback_text || undefined,
      }));

      const res = await api.post('/api/feedbacks/generate', {
        template_id: selectedTemplateId || undefined,
        students: payload,
      });
      navigate('/feedback/result', {
        state: {
          feedbacks: res.data.feedbacks,
          returnEvals: evals,
          returnTemplateId: selectedTemplateId,
        },
      });
    } catch {
      alert('生成失败，请重试');
      setPhase('evaluate');
    }
  };

  if (loading) return <Loading />;

  // ---- Phase: Select Students ----
  if (phase === 'select') {
    return (
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold mb-4">选择学生</h2>

        {/* Class tabs - single selection */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => handleClassChange(g.id)}
              className={`text-sm px-3 py-1.5 rounded-full whitespace-nowrap border ${
                selectedClassId === g.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {g.name} ({g.student_count})
            </button>
          ))}
        </div>

        {selectedClassId && (
          <>
            <div className="flex gap-2 mb-3">
              <input className="input flex-1" placeholder="搜索学生..." value={search} onChange={e => setSearch(e.target.value)} />
              <button onClick={toggleAllInClass} className="btn-secondary text-xs whitespace-nowrap">
                {filteredStudents.every(s => selectedIds.has(s.id)) ? '取消全选' : '全选'}
              </button>
            </div>

            <div className="text-xs text-gray-400 mb-2">
              已选 {selectedIds.size} / {filteredStudents.length} 人
            </div>
          </>
        )}

        <div className="space-y-2 mb-4">
          {filteredStudents.map(s => (
            <button
              key={s.id}
              className={`card w-full text-left flex items-center gap-3 ${
                selectedIds.has(s.id) ? 'ring-2 ring-primary-500' : ''
              }`}
              onClick={() => toggleStudent(s.id)}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                selectedIds.has(s.id) ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300'
              }`}>
                {selectedIds.has(s.id) && '✓'}
              </div>
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">
                  {s.grade || '未设置年级'}
                </div>
              </div>
            </button>
          ))}
          {selectedClassId && filteredStudents.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">该班级暂无学生</p>
          )}
          {!selectedClassId && groups.length > 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">请选择一个班级</p>
          )}
          {groups.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-2">还没有班级</p>
              <a href="/students" className="text-primary-600 text-sm" onClick={(e) => { e.preventDefault(); navigate('/students'); }}>
                去学生管理创建班级 &rarr;
              </a>
            </div>
          )}
        </div>

        <button
          className="btn-primary w-full"
          disabled={selectedIds.size === 0}
          onClick={startEval}
        >
          下一步 ({selectedIds.size}人)
        </button>
      </div>
    );
  }

  // ---- Phase: Generating ----
  if (phase === 'generating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-700">正在生成反馈...</p>
        <p className="text-sm text-gray-400 mt-1">预计 3-5 秒</p>
        <div className="w-48 bg-gray-200 rounded-full h-1.5 mt-4 overflow-hidden">
          <div className="bg-primary-600 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  // ---- Phase: Evaluate ----
  const current = evals[currentIdx];

  return (
    <div className="px-4 py-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setPhase('select')} className="text-sm text-primary-600">&larr; 返回选人</button>
        <span className="text-sm text-gray-500">{currentIdx + 1} / {evals.length}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1 mb-3">
        <div
          className="bg-primary-600 h-1 rounded-full transition-all"
          style={{ width: `${((currentIdx + 1) / evals.length) * 100}%` }}
        />
      </div>
      <div className="card mb-4 bg-primary-50 border-primary-200">
        <h3 className="font-bold text-primary-700">{current.student_name}</h3>
        <p className="text-xs text-gray-500">
          {current.student_grade || '未设年级'}
          {current.student_notes && ` · ${current.student_notes}`}
        </p>
      </div>

      {/* Template selector */}
      <div className="card mb-4">
        <p className="label mb-1">选择模板</p>
        {templates.length > 0 ? (
          <select
            className="input text-sm"
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
          >
            <option value="">默认风格</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (默认)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-400">
            暂无自定义模板，使用系统内置示例模板。
            <a href="/templates" className="text-primary-600 ml-1" onClick={(e) => { e.preventDefault(); navigate('/templates'); }}>去制作模板 &rarr;</a>
          </p>
        )}
      </div>

      {/* Previous feedback reference */}
      <div className="card mb-4 bg-amber-50 border-amber-200">
        <p className="text-sm font-medium text-amber-800 mb-2">上节课反馈引用</p>
        {current.lastFeedbackLoading ? (
          <p className="text-xs text-gray-400">加载中...</p>
        ) : current.lastFeedbackLoaded && current.previous_feedback_text ? (
          <div className="text-xs text-amber-700 whitespace-pre-wrap bg-white rounded p-2 border border-amber-100 max-h-32 overflow-y-auto">
            {current.previous_feedback_text}
          </div>
        ) : (
          <textarea
            className="input text-xs min-h-[60px]"
            placeholder="粘贴上节课反馈（可选），让 AI 写出更连贯的评语..."
            value={current.previous_feedback_text}
            onChange={e => updateEval(currentIdx, { previous_feedback_text: e.target.value })}
          />
        )}
      </div>

      <div className="space-y-4">
        {/* Knowledge text (required) — moved to top */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <p className="label"><span className="text-red-500">*</span> 本节课学习内容</p>
            {currentIdx > 0 && (
              <label className="flex items-center gap-1 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={inheritContent}
                  onChange={e => setInheritContent(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                沿用上一位学生
              </label>
            )}
          </div>
          <textarea
            className="input min-h-[70px]"
            placeholder="直接输入本节课所学内容，如：分数乘法、约分、应用题..."
            value={current.knowledge_text}
            onChange={e => updateEval(currentIdx, { knowledge_text: e.target.value })}
          />
        </div>

        {/* Homework — 推荐 */}
        <div className="card">
          <p className="label mb-1">课后作业 <span className="text-gray-400 font-normal">（推荐）</span></p>
          <input
            className="input"
            placeholder="如：练习册第10页1-3题"
            value={current.homework}
            onChange={e => updateEval(currentIdx, { homework: e.target.value })}
          />
        </div>

        {/* Four dimensions — 推荐标签放前面 */}
        {([
          { key: 'thinking', label: '思维与反应质量', rec: true },
          { key: 'knowledge_depth', label: '知识掌握程度', rec: true },
          { key: 'participation', label: '参与互动度', rec: false },
          { key: 'habits', label: '学习习惯', rec: false },
        ] as const).map(dim => {
          const val = (current as any)[dim.key] as DimensionEval;
          return (
            <div key={dim.key} className="card">
              <p className="label mb-2">{dim.label} <span className="text-gray-400 font-normal">{dim.rec ? '（推荐）' : '（可选）'}</span></p>

              {/* Progress eval */}
              <p className="text-xs text-gray-500 mb-1">进步评价（相对于上节课）</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PROGRESS_OPTS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => updateDim(currentIdx, dim.key, 'progress', opt)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      val?.progress === opt
                        ? 'bg-green-100 border-green-400 text-green-700'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {/* Current eval */}
              <p className="text-xs text-gray-500 mb-1">当前表现评价</p>
              <div className="flex flex-wrap gap-1.5">
                {CURRENT_OPTS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => updateDim(currentIdx, dim.key, 'current', opt)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      val?.current === opt
                        ? 'bg-blue-100 border-blue-400 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Behavior tags */}
        <div className="card">
          <p className="label mb-2">课堂表现标签</p>
          <div className="flex flex-wrap gap-2">
            {behaviorTags.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  const cur = current.behavior_tags;
                  const next = cur.includes(t.name) ? cur.filter(x => x !== t.name) : [...cur, t.name];
                  updateEval(currentIdx, { behavior_tags: next });
                }}
                className={`text-sm px-3 py-1.5 rounded-full border ${
                  current.behavior_tags.includes(t.name)
                    ? 'bg-primary-100 border-primary-300 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Focus */}
        <div className="card">
          <p className="label mb-1">专注度 <span className="text-gray-400 font-normal">（可选）</span></p>
          <StarRating value={current.focus} onChange={v => updateEval(currentIdx, { focus: v })} />
        </div>

        {/* Accuracy */}
        <div className="card">
          <p className="label mb-1">正确率 <span className="text-gray-400 font-normal">（可选）</span></p>
          <StarRating value={current.accuracy} onChange={v => updateEval(currentIdx, { accuracy: v })} />
        </div>

        {/* Extra comment */}
        <div className="card">
          <p className="label mb-1">额外评语</p>
          <textarea
            className="input min-h-[70px]"
            placeholder="补充说明...（可选）"
            value={current.extra_comment}
            onChange={e => updateEval(currentIdx, { extra_comment: e.target.value })}
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-2 pb-4">
          {currentIdx > 0 && (
            <button className="btn-secondary flex-1" onClick={() => setCurrentIdx(i => i - 1)}>
              上一个
            </button>
          )}
          {currentIdx < evals.length - 1 ? (
            <button
              className="btn-primary flex-1"
              onClick={() => {
                const prev = evals[currentIdx];
                setCurrentIdx(i => {
                  const next = i + 1;
                  // Inherit content from previous student
                  if (inheritContent) {
                    setEvals(prevEvals => prevEvals.map((e, idx) => {
                      if (idx === next) {
                        return {
                          ...e,
                          knowledge_text: e.knowledge_text || prev.knowledge_text,
                          homework: e.homework || prev.homework,
                        };
                      }
                      return e;
                    }));
                  }
                  return next;
                });
              }}
            >
              下一个学生
            </button>
          ) : (
            <button className="btn-primary flex-1" onClick={generate}>
              生成反馈 ({evals.length}人)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
