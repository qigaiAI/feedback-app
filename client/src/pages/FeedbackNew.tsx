import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api } from '../api/client';
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

interface Template {
  id: string;
  name: string;
  style_prompt: string;
  is_default: boolean;
}

interface PrevFeedback {
  id: string;
  content: string;
  created_at: string;
}

interface StudentEval {
  student_id: string;
  student_name: string;
  student_grade: string | null;
  student_notes: string | null;
  knowledge_text: string;
  extra_comment: string;
  homework: string;
  previous_feedback_id: string | null;
  previous_feedback_text: string;
  previous_feedbacks: PrevFeedback[];
  lastFeedbackLoaded: boolean;
  lastFeedbackLoading: boolean;
}

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
      sessionStorage.setItem('feedback_draft', JSON.stringify({
        evals: locationState.returnEvals,
        selectedTemplateId: locationState.returnTemplateId,
      }));
      window.history.replaceState({}, '');
    } else if (!locationState) {
      // Restore from sessionStorage (navigated away and back)
      const draft = sessionStorage.getItem('feedback_draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.evals && parsed.evals.length > 0) {
            setEvals(parsed.evals);
            setSelectedTemplateId(parsed.selectedTemplateId || '');
            setPhase('evaluate');
          }
        } catch { /* ignore */ }
      }
    }
  }, []);

  // Persist eval state to sessionStorage whenever it changes in evaluate phase
  useEffect(() => {
    if (phase === 'evaluate' && evals.length > 0) {
      sessionStorage.setItem('feedback_draft', JSON.stringify({
        evals,
        selectedTemplateId,
      }));
    }
  }, [evals, selectedTemplateId, phase]);

  useEffect(() => {
    Promise.all([
      api.get('/api/students'),
      api.get('/api/groups'),
      api.get('/api/templates'),
    ])
      .then(([sRes, gRes, tRes]) => {
        setStudents(sRes.data.students);
        setGroups(gRes.data.groups);
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
        // Fetch last 3 feedbacks for reference selection
        let prevId: string | null = null;
        let prevText = '';
        let prevFeedbacks: PrevFeedback[] = [];
        let loaded = false;
        let loadingDone = false;
        try {
          const r = await api.get(`/api/feedbacks/last/${s.id}?limit=3`);
          loadingDone = true;
          if (r.data.feedbacks && r.data.feedbacks.length > 0) {
            prevFeedbacks = r.data.feedbacks;
            prevId = r.data.feedbacks[0].id;
            prevText = r.data.feedbacks[0].content;
          }
          loaded = true;
        } catch { loaded = true; loadingDone = true; }

        return {
          student_id: s.id,
          student_name: s.name,
          student_grade: s.grade,
          student_notes: s.notes,
          knowledge_text: '',
          extra_comment: '',
          homework: '',
          previous_feedback_id: prevId,
          previous_feedback_text: prevText,
          previous_feedbacks: prevFeedbacks,
          lastFeedbackLoaded: loaded,
          lastFeedbackLoading: !loadingDone,
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
      sessionStorage.removeItem('feedback_draft');
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
        <button onClick={() => { setPhase('select'); sessionStorage.removeItem('feedback_draft'); }} className="text-sm text-primary-600">&larr; 返回选人</button>
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
        ) : (
          <>
            {current.previous_feedbacks.length > 0 && (
              <select
                className="input text-xs mb-2"
                value={current.previous_feedback_id || ''}
                onChange={e => {
                  const selected = current.previous_feedbacks.find(f => f.id === e.target.value);
                  updateEval(currentIdx, {
                    previous_feedback_id: selected?.id || null,
                    previous_feedback_text: selected?.content || '',
                  });
                }}
              >
                {current.previous_feedbacks.map((f, i) => (
                  <option key={f.id} value={f.id}>
                    第{i + 1}条 — {new Date(f.created_at).toLocaleDateString('zh-CN')}
                  </option>
                ))}
                <option value="">自己粘贴（不使用历史反馈）</option>
              </select>
            )}
            <textarea
              className="input text-xs min-h-[80px]"
              placeholder="引用上节课反馈（可选），可编辑修改，让 AI 写出更连贯的评语..."
              value={current.previous_feedback_text}
              onChange={e => updateEval(currentIdx, { previous_feedback_text: e.target.value })}
            />
          </>
        )}
      </div>

      <div className="space-y-4">
        {/* Knowledge text (required) */}
        <div className="card">
          <p className="label mb-1"><span className="text-red-500">*</span> 本节课学习内容</p>
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
            placeholder="如：练习册第10页1-3题"
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
            <button
              className="btn-primary flex-1"
              onClick={() => setCurrentIdx(i => i + 1)}
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
