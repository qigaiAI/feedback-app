import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  mastery?: string;
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

const PROGRESS_OPTS = ['有进步', '进步很大', '有一点退步'];
const CURRENT_OPTS = ['还需提高', '还不错', '非常好'];
const MASTERY_OPTS = ['完全掌握', '基本掌握', '部分掌握', '需重新讲解'];

export default function FeedbackNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<'select' | 'evaluate' | 'generating'>('select');

  // Student selection
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterGroup, setFilterGroup] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Evaluation
  const [evals, setEvals] = useState<StudentEval[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [behaviorTags, setBehaviorTags] = useState<BehaviorTag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const prefilledStudentId = searchParams.get('student');

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
        // Auto-select default template
        const def = tRes.data.templates.find((t: Template) => t.is_default);
        if (def) setSelectedTemplateId(def.id);

        if (prefilledStudentId) {
          setSelectedIds(new Set([prefilledStudentId]));
        }
      })
      .finally(() => setLoading(false));
  }, [prefilledStudentId]);

  const filteredStudents = students.filter(s => {
    if (search && !s.name.includes(search)) return false;
    if (filterGroup) {
      return s.groups.some(g => g.id === filterGroup);
    }
    return true;
  });

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    setPhase('generating');
    try {
      // Clean evals before sending
      const payload = evals.map(e => ({
        student_id: e.student_id,
        evaluations: {
          focus: e.focus,
          accuracy: e.accuracy,
          mastery: e.mastery,
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
      navigate('/feedback/result', { state: { feedbacks: res.data.feedbacks } });
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

        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input w-1/3" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
            <option value="">全部班级</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

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
                  {s.groups.length > 0 && ` · ${s.groups.map(g => g.name).join(', ')}`}
                </div>
              </div>
            </button>
          ))}
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
      {templates.length > 0 && (
        <div className="card mb-4">
          <p className="label mb-1">选择模板</p>
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
        </div>
      )}

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

        {/* Mastery */}
        <div className="card">
          <p className="label mb-1">掌握情况 <span className="text-gray-400 font-normal">（可选）</span></p>
          <div className="flex flex-wrap gap-2">
            {MASTERY_OPTS.map(opt => (
              <button
                key={opt}
                onClick={() => updateEval(currentIdx, { mastery: current.mastery === opt ? undefined : opt })}
                className={`text-sm px-3 py-1.5 rounded-full border ${
                  current.mastery === opt
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Four new dimensions */}
        {([
          { key: 'participation', label: '参与互动度' },
          { key: 'thinking', label: '思维与反应质量' },
          { key: 'habits', label: '学习习惯' },
          { key: 'knowledge_depth', label: '知识掌握程度' },
        ] as const).map(dim => {
          const val = (current as any)[dim.key] as DimensionEval;
          return (
            <div key={dim.key} className="card">
              <p className="label mb-2">{dim.label} <span className="text-gray-400 font-normal">（可选）</span></p>

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

        {/* Knowledge text (free form) */}
        <div className="card">
          <p className="label mb-1">本节课学习内容</p>
          <textarea
            className="input min-h-[70px]"
            placeholder="直接输入本节课所学内容，如：分数乘法、约分、应用题..."
            value={current.knowledge_text}
            onChange={e => updateEval(currentIdx, { knowledge_text: e.target.value })}
          />
        </div>

        {/* Homework */}
        <div className="card">
          <p className="label mb-1">课后作业</p>
          <input
            className="input"
            placeholder="如：练习册第10页1-3题（可选）"
            value={current.homework}
            onChange={e => updateEval(currentIdx, { homework: e.target.value })}
          />
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
            <button className="btn-primary flex-1" onClick={() => setCurrentIdx(i => i + 1)}>
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
