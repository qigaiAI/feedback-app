import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { copyToClipboard, openWechat } from '../utils/clipboard';

interface FeedbackItem {
  id?: string;
  student_id: string;
  content: string;
  student_name?: string;
}

export default function FeedbackResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    feedbacks: FeedbackItem[];
    returnEvals?: any[];
    returnTemplateId?: string;
  } | null;
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(state?.feedbacks || []);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (!state?.feedbacks || state.feedbacks.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-gray-500 mb-4">没有反馈结果</p>
        <button onClick={() => navigate('/feedback/new')} className="btn-primary">
          去写反馈
        </button>
      </div>
    );
  }

  const displayFeedbacks = feedbacks.map((f, i) => ({
    ...f,
    content: editing[i] ?? f.content,
  }));

  const hasChanges = Object.keys(editing).length > 0;

  const saveChanges = async () => {
    setSaving(true);
    try {
      const modifiedEntries = Object.entries(editing);
      for (const [idx, content] of modifiedEntries) {
        const f = feedbacks[parseInt(idx)];
        if (f && f.id && content !== f.content) {
          await api.put(`/api/feedbacks/${f.id}`, { content });
        }
      }
      // Update local feedbacks to reflect saved content, then clear editing
      setFeedbacks(prev => prev.map((f, i) => {
        const idx = String(i);
        if (idx in editing) {
          return { ...f, content: editing[parseInt(idx)] };
        }
        return f;
      }));
      setEditing({});
      alert('修改已保存');
    } catch { alert('保存失败'); }
    finally { setSaving(false); }
  };

  const copyAll = async () => {
    const text = displayFeedbacks.map(f => f.content).join('\n\n---\n\n');
    await copyToClipboard(text);
    alert('已复制全部反馈');
  };

  const copyOne = async (idx: number, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  };

  const sendToWechat = async (text: string) => {
    await copyToClipboard(text);
    openWechat();
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => navigate('/feedback/new')} className="text-sm text-primary-600">
            &larr; 返回选人
          </button>
          <button
            onClick={() => navigate('/feedback/new', {
              state: { returnEvals: state.returnEvals, returnTemplateId: state.returnTemplateId },
            })}
            className="text-sm text-gray-400"
          >
            返回修改
          </button>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <button onClick={saveChanges} className="btn-primary text-sm" disabled={saving}>
              {saving ? '保存中...' : '保存修改'}
            </button>
          )}
          <button onClick={copyAll} className="btn-secondary text-sm">复制全部</button>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4">反馈结果</h2>

      <div className="space-y-4">
        {displayFeedbacks.map((f, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary-600">
                {f.student_name || `学生 #${i + 1}`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => sendToWechat(f.content)}
                  className="text-xs text-green-600 px-2 py-1"
                >
                  复制并发微信
                </button>
                <button
                  onClick={() => copyOne(i, f.content)}
                  className="text-xs text-primary-600 px-2 py-1"
                >
                  {copiedIdx === i ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <textarea
              className="w-full text-sm border rounded-lg p-4 min-h-[350px] focus:ring-2 focus:ring-primary-500 outline-none resize-y"
              value={f.content}
              onChange={e => {
                setEditing(prev => ({ ...prev, [i]: e.target.value }));
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
