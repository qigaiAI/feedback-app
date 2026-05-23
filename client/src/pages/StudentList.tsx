import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Loading from '../components/Loading';
import ErrorMsg from '../components/ErrorMsg';

interface Student {
  id: string;
  name: string;
  grade: string | null;
  notes: string | null;
  groups: { id: string; name: string }[];
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  student_count: number;
}

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const gradeOptions = [
    '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
    '初一', '初二', '初三',
    '高一', '高二', '高三',
  ];

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedGroup) params.append('group_id', selectedGroup);
      const [sRes, gRes] = await Promise.all([
        api.get(`/api/students?${params}`),
        api.get('/api/groups'),
      ]);
      setStudents(sRes.data.students);
      setGroups(gRes.data.groups);
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  }, [search, selectedGroup]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/students', { name: newName, grade: newGrade, notes: newNotes });
      setNewName('');
      setNewGrade('');
      setNewNotes('');
      setShowAdd(false);
      fetchData();
    } catch {
      alert('添加失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (id: string, name: string) => {
    if (!confirm(`确定删除 ${name}？历史反馈不会删除。`)) return;
    try {
      await api.delete(`/api/students/${id}`);
      fetchData();
    } catch {
      alert('删除失败');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">学生管理</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm">
          {showAdd ? '取消' : '+ 添加'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addStudent} className="card mb-4 space-y-3">
          <input className="input" placeholder="姓名 *" value={newName} onChange={e => setNewName(e.target.value)} required />
          <div className="flex gap-2">
            <select className="input" value={newGrade} onChange={e => setNewGrade(e.target.value)}>
              <option value="">选择年级</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input className="input" placeholder="自定义年级" value={newGrade} onChange={e => setNewGrade(e.target.value)} />
          </div>
          <input className="input" placeholder="备注（选填）" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? '添加中...' : '确认添加'}
          </button>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="搜索学生..."
          value={search}
          onChange={e => { setSearch(e.target.value); setLoading(true); }}
        />
        <select
          className="input w-1/3"
          value={selectedGroup}
          onChange={e => { setSelectedGroup(e.target.value); setLoading(true); }}
        >
          <option value="">全部分组</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {error && <ErrorMsg message={error} onRetry={fetchData} />}

      <div className="space-y-2">
        {students.map(s => (
          <div key={s.id} className="card flex items-center justify-between">
            <Link to={`/students/${s.id}`} className="flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-gray-500">
                {s.grade && `${s.grade} · `}
                {s.groups.map(g => g.name).join(', ') || '未分组'}
                {s.notes && ` · ${s.notes}`}
              </div>
            </Link>
            <button
              onClick={() => deleteStudent(s.id, s.name)}
              className="text-red-400 text-sm px-3 py-1"
              style={{ minHeight: 44 }}
            >
              删除
            </button>
          </div>
        ))}
        {students.length === 0 && !error && (
          <p className="text-center text-gray-400 py-8">暂无学生，点击上方按钮添加</p>
        )}
      </div>
    </div>
  );
}
