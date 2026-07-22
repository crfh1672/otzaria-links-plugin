import React, { useState } from 'react';
import { OtzariaLink } from '../types';
import { X, Check, Trash2, ArrowLeftRight } from 'lucide-react';

interface EditLinkModalProps {
  commLineIndex: number; // 1-based
  commLineText: string;
  currentLink?: OtzariaLink;
  sourceLinesCount: number;
  isShas: boolean;
  onSave: (commLineIndex: number, newSourceLineIdx: number | null, secondaryTarget?: 'rashi' | 'tosafot') => void;
  onClose: () => void;
}

export const EditLinkModal: React.FC<EditLinkModalProps> = ({
  commLineIndex,
  commLineText,
  currentLink,
  sourceLinesCount,
  isShas,
  onSave,
  onClose,
}) => {
  const [targetLine, setTargetLine] = useState<number>(currentLink?.line_index_2 || 1);
  const [secondary, setSecondary] = useState<'none' | 'rashi' | 'tosafot'>(
    currentLink?.secondaryTarget || 'none'
  );

  const handleApply = () => {
    if (targetLine < 1 || targetLine > sourceLinesCount) return;
    onSave(
      commLineIndex,
      targetLine,
      secondary === 'none' ? undefined : secondary
    );
    onClose();
  };

  const handleDelete = () => {
    onSave(commLineIndex, null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <ArrowLeftRight className="w-4 h-4" />
            <span>עריכת קישור שורת פירוש #{commLineIndex}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="block text-[11px] font-bold text-slate-400 mb-1">טקסט השורה:</span>
            <p className="text-xs text-slate-800 dark:text-slate-200 font-serif leading-relaxed line-clamp-3">
              {commLineText}
            </p>
          </div>

          {/* Line Index Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              אינדקס שורת מקור להוספה/עדכון (1 עד {sourceLinesCount}):
            </label>
            <input
              type="number"
              min={1}
              max={sourceLinesCount}
              value={targetLine}
              onChange={e => setTargetLine(parseInt(e.target.value) || 1)}
              className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Secondary Routing Option (in Shas) */}
          {isShas && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ניתוב אל מקור משני (אופציונלי):
              </label>
              <select
                value={secondary}
                onChange={e => setSecondary(e.target.value as any)}
                className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="none">קישור ישיר למקור הראשי</option>
                <option value="rashi">מקור משני: רש"י</option>
                <option value="tosafot">מקור משני: תוספות</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>מחק קישור</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>אישור ושמירה</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
