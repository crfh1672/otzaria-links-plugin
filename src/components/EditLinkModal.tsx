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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] text-[var(--color-on-surface)] rounded-2xl border border-[var(--color-outline-variant)] shadow-xl max-w-md w-full overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--color-on-surface)] font-bold text-sm">
            <ArrowLeftRight className="w-4.5 h-4.5 text-current" />
            <span>עריכת קישור שורת פירוש #{commLineIndex}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-[var(--color-surface-container-low)]">
          <div className="bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-outline-variant)] shadow-2xs">
            <span className="block text-[11px] font-bold text-[var(--color-on-surface-variant)] mb-1">טקסט השורה:</span>
            <p className="text-xs text-[var(--color-on-surface)] font-serif leading-relaxed line-clamp-3">
              {commLineText}
            </p>
          </div>

          {/* Line Index Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--color-on-surface)]">
              אינדקס שורת מקור להוספה/עדכון (1 עד {sourceLinesCount}):
            </label>
            <input
              type="number"
              min={1}
              max={sourceLinesCount}
              value={targetLine}
              onChange={e => setTargetLine(parseInt(e.target.value) || 1)}
              className="w-full p-2.5 text-xs bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-medium"
            />
          </div>

          {/* Secondary Routing Option */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--color-on-surface)]">
              ניתוב אל מקור משני (אופציונלי):
            </label>
            <select
              value={secondary}
              onChange={e => setSecondary(e.target.value as any)}
              className="w-full p-2.5 text-xs bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-medium"
            >
              <option value="none">קישור ישיר למקור הראשי</option>
              <option value="rashi">מקור משני: רש"י</option>
              <option value="tosafot">מקור משני: תוספות</option>
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--color-surface-container-high)] border-t border-[var(--color-outline)] flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>מחק קישור</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-xl transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 rounded-xl transition-all shadow-2xs"
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
