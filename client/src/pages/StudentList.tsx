import { useState, useEffect, useCallback, useRef } from 'react';
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

const GRADE_OPTS = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
];

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newGradeCustom, setNewGradeCustom] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [showQuickClass, setShowQuickClass] = useState(false);
  const [quickClassName, setQuickClassName] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
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
  }, [debouncedSearch, selectedGroup]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const grade = newGradeCustom || newGrade;
      await api.post('/api/students', {
        name: newName,
        grade: grade || null,
        notes: newNotes || null,
        group_ids: newClassId ? [newClassId] : [],
        new_class_name: newClassName || undefined,
      });
      setNewName('');
      setNewGrade('');
      setNewGradeCustom('');
      setNewNotes('');
      setNewClassId('');
      setNewClassName('');
      setShowAdd(false);
      fetchData();
    } catch {
      alert('添加失败');
    } finally {
      setSaving(false);
    }
  };

  const quickCreateClass = async () => {
    if (!quickClassName.trim()) return;
    setCreatingClass(true);
    try {
      const res = await api.post('/api/groups', { name: quickClassName.trim() });
      setQuickClassName('');
      setShowQuickClass(false);
      setNewClassId(res.data.group.id);
      fetchData();
    } catch {
      alert('创建班级失败');
    } finally {
      setCreatingClass(false);
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
          <div>
            <label className="label text-xs">年级</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={newGrade} onChange={e => setNewGrade(e.target.value)}>
                <option value="">选择年级</option>
                {GRADE_OPTS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input className="input flex-1" placeholder="或自定义年级" value={newGradeCustom} onChange={e => setNewGradeCustom(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label text-xs">班级</label>
            {groups.length === 0 && !showQuickClass ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 mb-2">还没有班级，请先新建班级</p>
                <button type="button" onClick={() => setShowQuickClass(true)} className="btn-primary text-xs">
                  + 新建班级
                </button>
              </div>
            ) : (
              <>
                {showQuickClass && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                    <p className="text-xs text-blue-700 mb-2">新建班级</p>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-sm"
                        placeholder="输入班级名称"
                        value={quickClassName}
                        onChange={e => setQuickClassName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickCreateClass(); } }}
                      />
                      <button type="button" onClick={quickCreateClass} className="btn-primary text-xs" disabled={creatingClass}>
                        {creatingClass ? '创建中...' : '创建'}
                      </button>
                      <button type="button" onClick={() => setShowQuickClass(false)} className="btn-secondary text-xs">取消</button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={newClassId}
                    onChange={e => { setNewClassId(e.target.value); setNewClassName(''); }}
                  >
                    <option value="">
                      {groups.length === 0 ? '还没有班级，请先新建班级' : '选择班级'}
                    </option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {!showQuickClass && (
                    <button type="button" onClick={() => setShowQuickClass(true)} className="btn-secondary text-xs whitespace-nowrap">
                      + 新建班级
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="label text-xs">AI 备注（AI 生成反馈时会参考此信息）</label>
            <textarea
              className="input min-h-[60px]"
              placeholder="如：性格内向需多鼓励、口算弱注意力易分散..."
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
            />
          </div>
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
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input w-1/3"
          value={selectedGroup}
          onChange={e => setSelectedGroup(e.target.value)}
        >
          <option value="">全部班级</option>
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
                {s.groups.map(g => g.name).join(', ') || '未分班'}
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
