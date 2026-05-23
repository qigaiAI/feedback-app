import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Loading from '../components/Loading';
import ErrorMsg from '../components/ErrorMsg';

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

interface Feedback {
  id: string;
  content: string;
  created_at: string;
}

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editClassIds, setEditClassIds] = useState<string[]>([]);
  const [editNewClassName, setEditNewClassName] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/students/${id}`),
      api.get(`/api/feedbacks/history?student_id=${id}&limit=50`),
      api.get('/api/groups'),
    ])
      .then(([sRes, fRes, gRes]) => {
        const s = sRes.data.student;
        setStudent(s);
        setFeedbacks(fRes.data.feedbacks);
        setGroups(gRes.data.groups);
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    if (!student) return;
    setEditName(student.name);
    setEditGrade(student.grade || '');
    setEditNotes(student.notes || '');
    setEditClassIds(student.groups.map(g => g.id));
    setEditNewClassName('');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!student) return;
    setSaving(true);
    try {
      await api.put(`/api/students/${student.id}`, {
        name: editName,
        grade: editGrade || null,
        notes: editNotes || null,
        group_ids: editClassIds,
        new_class_name: editNewClassName || undefined,
      });
      // Refresh
      const r = await api.get(`/api/students/${student.id}`);
      setStudent(r.data.student);
      setEditing(false);
    } catch {
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleClass = (gid: string) => {
    setEditClassIds(prev => prev.includes(gid) ? prev.filter(x => x !== gid) : [...prev, gid]);
  };

  if (loading) return <Loading />;
  if (error || !student) return <ErrorMsg message={error || '学生不存在'} onRetry={() => window.location.reload()} />;

  return (
    <div className="px-4 py-4">
      <button onClick={() => navigate(-1)} className="text-sm text-primary-600 mb-4">&larr; 返回</button>

      {editing ? (
        <div className="card mb-4 space-y-3">
          <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="姓名" />
          <input className="input" value={editGrade} onChange={e => setEditGrade(e.target.value)} placeholder="年级" />
          <div>
            <label className="label text-xs">班级</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => toggleClass(g.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    editClassIds.includes(g.id)
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="或输入新班级名称新建"
              value={editNewClassName}
              onChange={e => setEditNewClassName(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">AI 备注</label>
            <textarea
              className="input min-h-[60px]"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              placeholder="如：性格内向需多鼓励..."
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={saveEdit} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button className="btn-secondary flex-1" onClick={() => setEditing(false)}>取消</button>
          </div>
        </div>
      ) : (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">{student.name}</h2>
            <div className="flex gap-2">
              <button onClick={startEdit} className="text-sm text-primary-600">编辑</button>
              <button
                onClick={() => navigate(`/feedback/new?student=${student.id}`)}
                className="text-sm text-primary-600"
              >
                写反馈
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {student.grade || '未设置年级'}
            {student.groups.length > 0 && ` · ${student.groups.map(g => g.name).join(', ')}`}
          </p>
          {student.notes && (
            <p className="text-sm text-gray-600 mt-2 bg-amber-50 rounded p-2 border border-amber-100">
              AI 备注：{student.notes}
            </p>
          )}
        </div>
      )}

      <h3 className="font-bold mb-3">历史反馈</h3>
      <div className="space-y-3">
        {feedbacks.map(f => (
          <div key={f.id} className="card">
            <p className="text-xs text-gray-400 mb-1">
              {new Date(f.created_at).toLocaleString('zh-CN')}
            </p>
            <p className="text-sm whitespace-pre-wrap">{f.content}</p>
          </div>
        ))}
        {feedbacks.length === 0 && (
          <p className="text-center text-gray-400 py-8">暂无反馈记录</p>
        )}
      </div>
    </div>
  );
}
