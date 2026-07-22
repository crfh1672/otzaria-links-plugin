import React, { useEffect, useState } from 'react';
import { SessionState } from '../types';
import { listCacheKeys, getFromCache, removeFromCache, notifySuccess, notifyError } from '../utils/otzariaBridge';
import { X, FolderOpen, Trash2, Clock, FileText, ArrowRight } from 'lucide-react';

interface ProjectsModalProps {
  onLoadSession: (session: SessionState) => void;
  onClose: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({ onLoadSession, onClose }) => {
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedProjects = async () => {
    setLoading(true);
    try {
      const keys = await listCacheKeys();
      const loaded: SessionState[] = [];
      for (const k of keys) {
        const item = await getFromCache<SessionState>(k);
        if (item && item.commentaryTitle && item.links) {
          loaded.push(item);
        }
      }
      loaded.sort((a, b) => (b.lastModifiedTimestamp || 0) - (a.lastModifiedTimestamp || 0));
      setSessions(loaded);
    } catch (e) {
      console.error(e);
      notifyError('שגיאה בטעינת פרויקטים שמורים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedProjects();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`האם למחוק את הפרויקט "${title}"?`)) return;
    try {
      await removeFromCache(id);
      notifySuccess('הפרויקט שנבחר נמחק בהצלחה');
      fetchSavedProjects();
    } catch {
      notifyError('שגיאה במחיקת פרויקט');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full overflow-hidden text-right flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <FolderOpen className="w-4 h-4" />
            <span>פרויקטים ומטמון שמור באוצריא</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">טוען פרויקטים שמורים...</div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              לא נמצאו פרויקטים שמורים במטמון
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {s.commentaryTitle}
                    </h4>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                      {s.config?.targetBookName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(s.lastModifiedTimestamp).toLocaleString('he-IL')}
                    </span>
                    <span>• {s.links?.length || 0} קישורים</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDelete(s.id, s.commentaryTitle)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                    title="מחק פרויקט"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      onLoadSession(s);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 rounded-md shadow-xs transition-colors"
                  >
                    <span>טען</span>
                    <ArrowRight className="w-3 h-3 rotate-180" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-left shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
