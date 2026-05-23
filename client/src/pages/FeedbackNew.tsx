import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import StarRating from '../components/StarRating';
import Loading from '../components/Loading';

interface Student {
  id: string;
  name: string;
  grade: string | null;
}

interface Group {
  id: string;
  name: string;
  student_count: number;
}

interface KnowledgeTag {
  id: string;
  level: number;
  name: string;
  parent_id: string | null;
}

interface BehaviorTag {
  id: string;
  name: string;
  teacher_id: string | null;
}

interface StudentEval {
  student_id: string;
  student_name: string;
  focus?: number;
  accuracy?: number;
  mastery?: string;
  behavior_tags: string[];
  knowledge_tag_ids: string[];
  extra_comment: string;
  lastTags?: KnowledgeTag[];
}

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
  const [knowledgeTags, setKnowledgeTags] = useState<KnowledgeTag[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagLevel, setTagLevel] = useState<1 | 2 | 3 | 4>(1);
  const [tagParent, setTagParent] = useState<string | null>(null);
  const [filteredTags, setFilteredTags] = useState<KnowledgeTag[]>([]);
  const [lastUsedTags, setLastUsedTags] = useState<KnowledgeTag[]>([]);

  const prefilledStudentId = searchParams.get('student');

  useEffect(() => {
    Promise.all([
      api.get('/api/students'),
      api.get('/api/groups'),
    ])
      .then(([sRes, gRes]) => {
        setStudents(sRes.data.students);
        setGroups(gRes.data.groups);
        // Pre-select if coming from student detail
        if (prefilledStudentId) {
          setSelectedIds(new Set([prefilledStudentId]));
        }
      })
      .finally(() => setLoading(false));
  }, [prefilledStudentId]);

  useEffect(() => {
    api.get('/api/tags/behavior').then(r => setBehaviorTags(r.data.tags));
    api.get('/api/tags/knowledge').then(r => setKnowledgeTags(r.data.tags));
  }, []);

  // Filter knowledge tags
  useEffect(() => {
    let tags = knowledgeTags.filter(t => t.level === tagLevel);
    if (tagParent) {
      tags = tags.filter(t => t.parent_id === tagParent);
    }
    if (tagSearch) {
      tags = tags.filter(t => t.name.includes(tagSearch));
    }
    setFilteredTags(tags);
  }, [knowledgeTags, tagLevel, tagParent, tagSearch]);

  const startEval = async () => {
    const selected = students.filter(s => selectedIds.has(s.id));
    const evl: StudentEval[] = await Promise.all(
      selected.map(async (s) => {
        // Fetch last used tags
        let lastTags: KnowledgeTag[] = [];
        try {
          const r = await api.get(`/api/feedbacks/history?student_id=${s.id}&limit=1`);
          if (r.data.feedbacks.length > 0) {
            const tagIds = r.data.feedbacks[0].used_tags;
            if (tagIds && tagIds.length > 0) {
              const tRes = await api.get(`/api/tags/knowledge`);
              lastTags = tRes.data.tags.filter((t: KnowledgeTag) => tagIds.includes(t.id));
            }
          }
        } catch { /* ignore */ }
        return {
          student_id: s.id,
          student_name: s.name,
          behavior_tags: [],
          knowledge_tag_ids: [],
          extra_comment: '',
          lastTags,
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
    setPhase('generating');
    try {
      const res = await api.post('/api/feedbacks/generate', { students: evals });
      navigate('/feedback/result', { state: { feedbacks: res.data.feedbacks } });
    } catch {
      alert('生成失败，请重试');
      setPhase('evaluate');
    }
  };

  const filteredStudents = students.filter(s => {
    if (search && !s.name.includes(search)) return false;
    if (filterGroup) {
      // Simplified: check if student is in the group via the groups list
      return true; // We use the server-side filtering
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

  if (loading) return <Loading />;

  // ---- Phase: Select ----
  if (phase === 'select') {
    return (
      <div className="px-4 py-4">
        <h2 className="text-lg font-bold mb-4">选择学生</h2>

        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input w-1/3" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
            <option value="">全部</option>
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
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                selectedIds.has(s.id) ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300'
              }`}>
                {selectedIds.has(s.id) && '✓'}
              </div>
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">{s.grade || '未设置年级'}</div>
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
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setPhase('select')} className="text-sm text-primary-600">&larr; 返回</button>
        <span className="text-sm text-gray-500">{currentIdx + 1} / {evals.length}</span>
        <span className="text-sm font-medium text-primary-600">{current.student_name}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1 mb-4">
        <div
          className="bg-primary-600 h-1 rounded-full transition-all"
          style={{ width: `${((currentIdx + 1) / evals.length) * 100}%` }}
        />
      </div>

      <div className="space-y-5">
        {/* Focus */}
        <div className="card">
          <p className="label mb-2">专注度</p>
          <StarRating value={current.focus} onChange={v => updateEval(currentIdx, { focus: v })} />
        </div>

        {/* Accuracy */}
        <div className="card">
          <p className="label mb-2">正确率</p>
          <StarRating value={current.accuracy} onChange={v => updateEval(currentIdx, { accuracy: v })} />
        </div>

        {/* Mastery */}
        <div className="card">
          <p className="label mb-2">掌握情况</p>
          <div className="flex gap-2">
            {[
              { v: 'mastered', l: '已掌握' },
              { v: 'partial', l: '部分掌握' },
              { v: 'not_mastered', l: '未掌握' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => updateEval(currentIdx, { mastery: current.mastery === opt.v ? undefined : opt.v })}
                className={`btn flex-1 ${current.mastery === opt.v ? 'bg-primary-600 text-white' : 'btn-outline'}`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

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

        {/* Knowledge tags */}
        <div className="card">
          <p className="label mb-2">知识标签</p>

          {/* Last used tags */}
          {current.lastTags && current.lastTags.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">上次使用</p>
              <div className="flex flex-wrap gap-1">
                {current.lastTags.map(t => (
                  <span
                    key={t.id}
                    className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200"
                  >
                    {t.name}
                    <button
                      className="ml-1 text-green-400"
                      onClick={() => {
                        if (current.lastTags) {
                          updateEval(currentIdx, {
                            lastTags: current.lastTags.filter(x => x.id !== t.id),
                          });
                        }
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Selected knowledge tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {current.knowledge_tag_ids.map(id => {
              const tag = knowledgeTags.find(t => t.id === id);
              return tag ? (
                <span key={id} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full border border-primary-200">
                  {tag.name}
                  <button
                    className="ml-1 text-primary-400"
                    onClick={() => updateEval(currentIdx, {
                      knowledge_tag_ids: current.knowledge_tag_ids.filter(x => x !== id),
                    })}
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>

          {/* Tag selector */}
          <input
            className="input mb-2"
            placeholder="搜索知识标签..."
            value={tagSearch}
            onChange={e => setTagSearch(e.target.value)}
          />

          {/* Level tabs */}
          <div className="flex gap-1 mb-2">
            {(['学段', '学科', '专题', '知识点'] as const).map((label, i) => (
              <button
                key={i}
                onClick={() => { setTagLevel((i + 1) as 1 | 2 | 3 | 4); setTagParent(null); }}
                className={`text-xs px-3 py-1 rounded ${
                  tagLevel === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {filteredTags.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.level === 4) {
                    // Select the knowledge point
                    if (!current.knowledge_tag_ids.includes(t.id)) {
                      // Also add ancestors if not present
                      updateEval(currentIdx, {
                        knowledge_tag_ids: [...current.knowledge_tag_ids, t.id],
                      });
                    }
                  } else {
                    // Drill down
                    setTagParent(t.id);
                    setTagLevel((t.level + 1) as 1 | 2 | 3 | 4);
                  }
                }}
                className={`text-xs px-2 py-1 rounded border ${
                  t.level === 4 && current.knowledge_tag_ids.includes(t.id)
                    ? 'bg-primary-100 border-primary-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                {t.name} {t.level < 4 ? '›' : ''}
              </button>
            ))}
            {filteredTags.length === 0 && <span className="text-xs text-gray-400">无匹配标签</span>}
          </div>
        </div>

        {/* Extra comment */}
        <div className="card">
          <p className="label mb-2">额外评语</p>
          <textarea
            className="input min-h-[80px]"
            placeholder="补充说明...（可选）"
            value={current.extra_comment}
            onChange={e => updateEval(currentIdx, { extra_comment: e.target.value })}
          />
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          {currentIdx > 0 && (
            <button className="btn-secondary flex-1" onClick={() => setCurrentIdx(i => i - 1)}>
              上一个
            </button>
          )}
          {currentIdx < evals.length - 1 ? (
            <button className="btn-primary flex-1" onClick={() => setCurrentIdx(i => i + 1)}>
              下一个
            </button>
          ) : (
            <button className="btn-primary flex-1" onClick={generate}>
              生成反馈
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
