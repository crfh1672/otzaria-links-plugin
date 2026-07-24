import React, { useState } from 'react';
import { OtzariaLink } from '../types';
import { X, Check, Trash2, ArrowLeftRight, Search, CheckCircle2, Layers, BookOpen } from 'lucide-react';

interface EditLinkModalProps {
  commLineIndex: number; // 1-based
  commLineText: string;
  currentLink?: OtzariaLink;
  sourceLinesCount: number;
  sourceLines?: string[];
  rashiLines?: string[];
  tosafotLines?: string[];
  targetBookName?: string;
  isShas: boolean;
  onSave: (commLineIndex: number, newSourceLineIdx: number | null, secondaryTarget?: 'rashi' | 'tosafot') => void;
  onClose: () => void;
}

export const EditLinkModal: React.FC<EditLinkModalProps> = ({
  commLineIndex,
  commLineText,
  currentLink,
  sourceLinesCount,
  sourceLines = [],
  rashiLines = [],
  tosafotLines = [],
  targetBookName = 'גמרא',
  isShas,
  onSave,
  onClose,
}) => {
  // Determine initial active tab and line index
  const initialTab = currentLink?.secondaryTarget || 'primary';
  const initialLineIdx = currentLink?.secondaryTarget
    ? (currentLink.secondary_line_index || 1)
    : (currentLink?.line_index_2 || 1);

  const [activeTab, setActiveTab] = useState<'primary' | 'rashi' | 'tosafot'>(initialTab as any);
  const [targetLine, setTargetLine] = useState<number>(initialLineIdx);
  const [secondary, setSecondary] = useState<'none' | 'rashi' | 'tosafot'>(
    currentLink?.secondaryTarget || 'none'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});

  const handleApply = () => {
    if (targetLine < 1) return;
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

  const handleSelectLine = (lineIdx1: number, tabType: 'primary' | 'rashi' | 'tosafot') => {
    setTargetLine(lineIdx1);
    setSecondary(tabType === 'primary' ? 'none' : tabType);
  };

  const toggleExpand = (lineKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLines(prev => ({ ...prev, [lineKey]: !prev[lineKey] }));
  };

  // Lines for current tab
  const getTabLines = () => {
    if (activeTab === 'primary') {
      if (sourceLines.length > 0) return sourceLines;
      return Array.from({ length: sourceLinesCount }, (_, i) => `שורה ${i + 1}`);
    }
    if (activeTab === 'rashi') return rashiLines;
    if (activeTab === 'tosafot') return tosafotLines;
    return [];
  };

  const currentTabLines = getTabLines();

  // Filter lines by search query
  const filteredLines = currentTabLines.map((text, idx) => ({ text, lineIdx1: idx + 1 })).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    if (item.lineIdx1.toString() === q) return true;
    return item.text.toLowerCase().includes(q);
  });

  const getTabTitle = (tab: 'primary' | 'rashi' | 'tosafot') => {
    if (tab === 'primary') return targetBookName || 'גמרא / מקור ראשי';
    if (tab === 'rashi') return 'רש"י';
    return 'תוספות';
  };

  const isCurrentTabRashiOrTosafot = activeTab === 'rashi' || activeTab === 'tosafot';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 md:p-4">
      <div className="bg-[var(--color-surface)] text-[var(--color-on-surface)] rounded-2xl border border-[var(--color-outline-variant)] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-right" dir="rtl">
        {/* Header */}
        <div className="p-4 bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[var(--color-on-surface)] font-bold text-sm md:text-base">
            <ArrowLeftRight className="w-5 h-5 text-[var(--color-primary)]" />
            <span>עריכת קישור שורת פירוש #{commLineIndex}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 md:p-5 space-y-4 overflow-y-auto flex-1 bg-[var(--color-surface-container-low)]">
          {/* Commentary Line Text Box */}
          <div className="bg-[var(--color-surface)] p-3.5 md:p-4 rounded-xl border border-[var(--color-outline-variant)] shadow-2xs space-y-1">
            <span className="block text-xs font-bold text-[var(--color-on-surface-variant)]">טקסט הפירוש (שורה {commLineIndex}):</span>
            <p className="text-sm font-sans leading-relaxed text-[var(--color-on-surface)] font-medium">
              {commLineText}
            </p>
          </div>

          {/* Source Tabs Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-on-surface)]">בחר מקור ושורה לקישור:</span>
              <span className="text-xs text-[var(--color-primary)] font-semibold">
                נבחר: {getTabTitle(secondary === 'none' ? 'primary' : secondary)} - שורה {targetLine}
              </span>
            </div>

            {/* Tabs Bar */}
            <div className="flex items-center gap-1.5 bg-[var(--color-surface)] p-1.5 rounded-xl border border-[var(--color-outline)]">
              {/* Primary Tab */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('primary');
                  setSecondary('none');
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'primary'
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xs'
                    : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)]'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>{targetBookName || 'גמרא'}</span>
                <span className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-md text-[11px]">
                  {sourceLines.length || sourceLinesCount}
                </span>
              </button>

              {/* Rashi Tab */}
              {(rashiLines.length > 0 || isShas) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('rashi');
                    setSecondary('rashi');
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'rashi'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>רש"י</span>
                  {rashiLines.length > 0 && (
                    <span className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-md text-[11px]">
                      {rashiLines.length}
                    </span>
                  )}
                </button>
              )}

              {/* Tosafot Tab */}
              {(tosafotLines.length > 0 || isShas) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('tosafot');
                    setSecondary('tosafot');
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'tosafot'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-indigo-800 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>תוספות</span>
                  {tosafotLines.length > 0 && (
                    <span className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-md text-[11px]">
                      {tosafotLines.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Filter Search Bar & Manual Line Number Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`סינון בתוך ${getTabTitle(activeTab)} לפי טקסט או מספר שורה...`}
                  className="w-full pr-9 pl-3 py-2 text-xs md:text-sm bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0 bg-[var(--color-surface)] px-2.5 py-1.5 rounded-xl border border-[var(--color-outline)]">
                <span className="text-xs font-bold text-[var(--color-on-surface-variant)]">שורה:</span>
                <input
                  type="number"
                  min={1}
                  max={currentTabLines.length || 999}
                  value={targetLine}
                  onChange={e => handleSelectLine(parseInt(e.target.value) || 1, activeTab)}
                  className="w-14 text-xs font-bold text-center bg-transparent border-none focus:outline-none text-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Lines Grid / Cards List */}
            <div className="max-h-[340px] overflow-y-auto space-y-2.5 p-1 rounded-xl">
              {filteredLines.length === 0 ? (
                <div className="p-8 text-center text-xs md:text-sm text-[var(--color-on-surface-variant)] bg-[var(--color-surface)] rounded-xl border border-dashed border-[var(--color-outline)] font-medium">
                  לא נמצאו שורות מתאימות ב-{getTabTitle(activeTab)}
                </div>
              ) : (
                filteredLines.map(({ text, lineIdx1 }) => {
                  const isSelected =
                    (activeTab === 'primary' && secondary === 'none' && targetLine === lineIdx1) ||
                    (activeTab === 'rashi' && secondary === 'rashi' && targetLine === lineIdx1) ||
                    (activeTab === 'tosafot' && secondary === 'tosafot' && targetLine === lineIdx1);

                  const lineKey = `${activeTab}-${lineIdx1}`;
                  const isExpanded = expandedLines[lineKey];

                  let activeCardStyle = 'bg-[var(--color-surface)] border-[var(--color-outline-variant)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-container-low)]';
                  if (isSelected) {
                    activeCardStyle = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-950 dark:text-emerald-100';
                  }

                  return (
                    <div
                      key={lineKey}
                      onClick={() => handleSelectLine(lineIdx1, activeTab)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 text-right relative ${activeCardStyle}`}
                    >
                      {/* Top line card info */}
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md font-mono ${isSelected ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100' : 'bg-[var(--color-secondary-subtle)] text-[var(--color-primary)]'}`}>
                            שורה {lineIdx1}
                          </span>
                          <span className="text-[11px] text-[var(--color-on-surface-variant)]">
                            ({getTabTitle(activeTab)})
                          </span>
                        </div>

                        {isSelected && (
                          <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>שורה נבחרת</span>
                          </span>
                        )}
                      </div>

                      {/* Line content text */}
                      {text ? (
                        <div className="space-y-1">
                          <p
                            className={`text-xs md:text-sm font-sans leading-relaxed text-[var(--color-on-surface)] ${
                              isCurrentTabRashiOrTosafot && !isExpanded ? 'line-clamp-3' : ''
                            }`}
                          >
                            {text}
                          </p>

                          {isCurrentTabRashiOrTosafot && text.length > 180 && (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(lineKey, e)}
                              className="text-[11px] text-[var(--color-primary)] hover:underline font-bold"
                            >
                              {isExpanded ? 'צמצם ל-3 שורות' : 'הרחב טקסט מלא'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--color-on-surface-variant)] italic">
                          שורה ריקה
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--color-surface-container-high)] border-t border-[var(--color-outline)] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>מחק קישור</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-xl transition-colors"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 rounded-xl transition-all shadow-2xs"
            >
              <Check className="w-4 h-4" />
              <span>אישור ושמירה</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
