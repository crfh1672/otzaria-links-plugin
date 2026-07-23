import React, { useState } from 'react';
import { SessionState, OtzariaLink, DHHighlight } from '../types';
import { formatLineWithDH } from '../utils/parserAlgorithm';
import { EditLinkModal } from './EditLinkModal';
import {
  Edit3,
  Trash2,
  Plus,
  Minus,
  GripVertical,
  Link2,
  Link2Off,
  Layers,
  AlertTriangle,
  Info
} from 'lucide-react';

interface EditModeProps {
  session: SessionState;
  onUpdateSession: (updated: SessionState) => void;
}

export const EditMode: React.FC<EditModeProps> = ({ session, onUpdateSession }) => {
  const [editingCommLineIdx, setEditingCommLineIdx] = useState<number | null>(null);
  const [draggedCommLineIdx, setDraggedCommLineIdx] = useState<number | null>(null);
  const [dragOverSourceIdx, setDragOverSourceIdx] = useState<number | null>(null);

  // Pagination & Filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(40);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [filterLinkedOnly, setFilterLinkedOnly] = useState(false);

  const {
    commentaryLines,
    sourceLines,
    rashiLines,
    tosafotLines,
    links,
    dhHighlights = {},
    config
  } = session;

  // Group commentary lines by target source line index (line_index_2)
  const linksBySourceLine = React.useMemo(() => {
    const map: Record<number, OtzariaLink[]> = {};
    links.forEach(link => {
      if (!map[link.line_index_2]) {
        map[link.line_index_2] = [];
      }
      map[link.line_index_2].push(link);
    });
    return map;
  }, [links]);

  // Set of linked commentary line indices (1-based)
  const linkedCommLineIndices = React.useMemo(() => {
    return new Set(links.map(l => l.line_index_1));
  }, [links]);

  // Filtered source line array indices
  const filteredSourceIndices = React.useMemo(() => {
    const indices: number[] = [];
    const q = sourceSearchQuery.toLowerCase().trim();

    sourceLines.forEach((line, idx) => {
      const srcLineIdx1 = idx + 1;
      const linkedCount = (linksBySourceLine[srcLineIdx1] || []).length;

      if (filterLinkedOnly && linkedCount === 0) return;

      if (q) {
        const lineMatches = line.toLowerCase().includes(q) || srcLineIdx1.toString() === q;
        const commMatches = (linksBySourceLine[srcLineIdx1] || []).some(l => {
          const commText = commentaryLines[l.line_index_1 - 1] || '';
          return commText.toLowerCase().includes(q);
        });
        if (!lineMatches && !commMatches) return;
      }

      indices.push(idx);
    });

    return indices;
  }, [sourceLines, linksBySourceLine, filterLinkedOnly, sourceSearchQuery, commentaryLines]);

  const totalPages = Math.max(1, Math.ceil(filteredSourceIndices.length / pageSize));
  
  // Reset page if filtered results contract
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredSourceIndices.length, totalPages, currentPage]);

  const currentPageIndices = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSourceIndices.slice(start, start + pageSize);
  }, [filteredSourceIndices, currentPage, pageSize]);

  // Unlinked commentary lines
  const unlinkedCommLines = React.useMemo(() => {
    const unlinked: { lineIndex1: number; text: string }[] = [];
    commentaryLines.forEach((line, idx) => {
      const lineIdx1 = idx + 1; // 1-based
      // Ignore header lines or empty lines
      if (!line.trim() || /<h[1-6][^>]*>.*<\/h[1-6]>/i.test(line) || /^#{1,6}\s+/.test(line)) {
        return;
      }
      if (!linkedCommLineIndices.has(lineIdx1)) {
        unlinked.push({ lineIndex1: lineIdx1, text: line });
      }
    });
    return unlinked;
  }, [commentaryLines, linkedCommLineIndices]);

  // Update DH Highlight word count (+1 or -1)
  const handleAdjustDH = (commLineIdx1: number, delta: number) => {
    const current = dhHighlights[commLineIdx1] || { wordStart: 0, wordCount: 3 };
    const lineText = commentaryLines[commLineIdx1 - 1] || '';
    const totalWords = lineText.trim().split(/\s+/).filter(Boolean).length;

    const newCount = Math.max(0, Math.min(totalWords, current.wordCount + delta));
    const newHighlights: Record<number, DHHighlight> = {
      ...dhHighlights,
      [commLineIdx1]: { ...current, wordCount: newCount }
    };

    onUpdateSession({
      ...session,
      dhHighlights: newHighlights,
      lastModifiedTimestamp: Date.now()
    });
  };

  // Add / Update / Remove Link
  const handleSaveLink = (
    commLineIdx1: number,
    newSourceLineIdx: number | null,
    secondaryTarget?: 'rashi' | 'tosafot'
  ) => {
    let updatedLinks = [...links];

    // Filter out old link for this commentary line if exists
    updatedLinks = updatedLinks.filter(l => l.line_index_1 !== commLineIdx1);

    if (newSourceLineIdx && newSourceLineIdx >= 1 && newSourceLineIdx <= sourceLines.length) {
      const headerTitle = config.targetBookName;
      const newLink: OtzariaLink = {
        line_index_1: commLineIdx1,
        line_index_2: newSourceLineIdx,
        heRef_2: `${headerTitle}, שורה ${newSourceLineIdx}`,
        path_2: `${config.targetBookName}.txt`,
        connection_type: "commentary",
        secondaryTarget,
        secondary_line_index: secondaryTarget ? 1 : undefined,
        secondaryRef: secondaryTarget ? `${secondaryTarget === 'rashi' ? 'רש"י' : 'תוספות'}` : undefined,
        isInherited: false
      };
      updatedLinks.push(newLink);
    }

    onUpdateSession({
      ...session,
      links: updatedLinks,
      lastModifiedTimestamp: Date.now()
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (commLineIdx1: number) => {
    setDraggedCommLineIdx(commLineIdx1);
  };

  const handleDragOver = (e: React.DragEvent, sourceLineIdx1: number) => {
    e.preventDefault();
    setDragOverSourceIdx(sourceLineIdx1);
  };

  const handleDropOnSourceCard = (sourceLineIdx1: number) => {
    if (draggedCommLineIdx) {
      handleSaveLink(draggedCommLineIdx, sourceLineIdx1);
      setDraggedCommLineIdx(null);
      setDragOverSourceIdx(null);
    }
  };

  const handleDropUnlink = () => {
    if (draggedCommLineIdx) {
      handleSaveLink(draggedCommLineIdx, null);
      setDraggedCommLineIdx(null);
      setDragOverSourceIdx(null);
    }
  };

  // Render a commentary line box with interactive DH editing and drag handle
  const renderCommentaryBox = (linkObj?: OtzariaLink, commIdx1?: number) => {
    const lineIdx1 = linkObj ? linkObj.line_index_1 : commIdx1!;
    const rawLineText = commentaryLines[lineIdx1 - 1] || '';
    const highlight = dhHighlights[lineIdx1] || { wordStart: 0, wordCount: 3 };

    // Check color state per SRS:
    // Unlinked: subtle red (rgba(255,0,0,0.05))
    // Inherited: subtle purple (rgba(128,0,128,0.08))
    const isUnlinked = !linkObj;
    const isInherited = linkObj?.isInherited;

    let bgStyle = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";
    if (isUnlinked) {
      bgStyle = "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60";
    } else if (isInherited) {
      bgStyle = "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/60";
    }

    // Format text with HTML <b> tag for DH
    const formattedHtml = formatLineWithDH(rawLineText, highlight);

    return (
      <div
        key={`comm-${lineIdx1}`}
        draggable
        onDragStart={() => handleDragStart(lineIdx1)}
        className={`group relative p-3 rounded-lg border shadow-2xs transition-all ${bgStyle} hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600`}
      >
        {/* Top Indicators */}
        <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-mono font-bold">
            <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab active:cursor-grabbing" />
            <span>שורה {lineIdx1}</span>
            {isInherited && (
              <span className="bg-purple-200/80 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-[10px] px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>ירושת הקשר</span>
              </span>
            )}
            {isUnlinked && (
              <span className="bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 text-[10px] px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>ללא מקור מקושר</span>
              </span>
            )}
          </div>

          {/* Floating / Hover Actions */}
          <div className="opacity-80 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            {/* DH Word Highlight Controls */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700 ml-1">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 px-1">
                ד"ה ({highlight.wordCount} מילים)
              </span>
              <button
                type="button"
                onClick={() => handleAdjustDH(lineIdx1, 1)}
                className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-indigo-600 dark:text-indigo-400"
                title="הוסף מילה להדגשת דיבור המתחיל"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDH(lineIdx1, -1)}
                className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-rose-600 dark:text-rose-400"
                title="הסר מילה מהדגשת דיבור המתחיל"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>

            {/* Direct Edit Button */}
            <button
              onClick={() => setEditingCommLineIdx(lineIdx1)}
              className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded transition-colors"
              title="ערוך קישור ידנית"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {!isUnlinked && (
              <button
                onClick={() => handleSaveLink(lineIdx1, null)}
                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded transition-colors"
                title="נתק קישור"
              >
                <Link2Off className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Text with <b> highlighting */}
        <div
          className="text-xs font-serif leading-relaxed text-slate-900 dark:text-slate-100 [&_b]:font-bold [&_b]:text-indigo-700 dark:[&_b]:text-amber-300 [&_b]:bg-indigo-50 dark:[&_b]:bg-indigo-950/60 [&_b]:px-1 [&_b]:py-0.5 [&_b]:rounded"
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />

        {/* Secondary Source Sub-pane indicator */}
        {linkObj?.secondaryTarget && (
          <div className="mt-2 p-2 bg-amber-50/80 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              מקושר למקור משני ({linkObj.secondaryTarget === 'rashi' ? 'רש"י' : 'תוספות'}
              {linkObj.secondary_line_index ? `, שורה ${linkObj.secondary_line_index}` : ''})
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* Edit Mode Header Info */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>סביבת עריכה אינטראקטיבית - כרטיסיות מקושרות</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ניתן לגרור שורת פירוש ולהשליך לתוך כרטיסיית מקור, להוסיף/להסיר מילים מדיבור המתחיל (ד"ה), או לערוך דיאלוג.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300 inline-block" />
            <span className="text-slate-600 dark:text-slate-300">ירושת הקשר</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" />
            <span className="text-slate-600 dark:text-slate-300">ללא מקור</span>
          </div>
        </div>
      </div>

      {/* Main Dual-Side Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Linked Source & Commentary Unified Cards Column (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            {/* Search filter */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={sourceSearchQuery}
                onChange={e => {
                  setSourceSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="סינון/חיפוש בשורות מקור או פירוש..."
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => {
                setFilterLinkedOnly(!filterLinkedOnly);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                filterLinkedOnly
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              {filterLinkedOnly ? 'מציג מקושרים בלבד' : 'הצג הכל'}
            </button>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-40 rounded border border-slate-300 dark:border-slate-700"
                >
                  הקודם
                </button>
                <span>
                  עמוד {currentPage} מתוך {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-40 rounded border border-slate-300 dark:border-slate-700"
                >
                  הבא
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              מציג {currentPageIndices.length} שורות מקור (סה"כ {filteredSourceIndices.length})
            </span>
          </div>

          {currentPageIndices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
              לא נמצאו שורות מקור המתאימות לסינון
            </div>
          ) : (
            currentPageIndices.map(idx => {
              const srcLine = sourceLines[idx];
              const srcLineIdx1 = idx + 1; // 1-based index
              const isHeader = /<h[1-6][^>]*>.*<\/h[1-6]>/i.test(srcLine) || /^#{1,6}\s+/.test(srcLine);
              const linkedCommLinks = linksBySourceLine[srcLineIdx1] || [];
              const isDragOver = dragOverSourceIdx === srcLineIdx1;

              if (isHeader) {
                return (
                  <div
                    key={`src-hdr-${srcLineIdx1}`}
                    className="my-4 p-3 bg-indigo-900 text-white rounded-lg shadow-sm border border-indigo-800 font-bold text-sm"
                    dangerouslySetInnerHTML={{ __html: srcLine }}
                  />
                );
              }

              return (
                <div
                  key={`src-card-${srcLineIdx1}`}
                  onDragOver={e => handleDragOver(e, srcLineIdx1)}
                  onDrop={() => handleDropOnSourceCard(srcLineIdx1)}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-xl border transition-all ${
                    isDragOver
                      ? 'border-2 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-400/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  {/* Left Side: Target Source Line (5 Cols) */}
                  <div className="md:col-span-5 border-l-0 md:border-l border-slate-200 dark:border-slate-800 pl-0 md:pl-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      <span>{config.targetBookName} - שורה {srcLineIdx1}</span>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                        מקור
                      </span>
                    </div>

                    <p className="text-xs font-serif leading-relaxed text-slate-800 dark:text-slate-200">
                      {srcLine}
                    </p>

                    {/* If secondary source line content exists for this header */}
                    {rashiLines && rashiLines[srcLineIdx1 - 1] && (
                      <div className="mt-2 p-2 bg-amber-50/60 dark:bg-amber-950/20 rounded border border-amber-200/60 dark:border-amber-900/40 text-[11px]">
                        <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                          מקור משני (רש"י):
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 font-serif leading-tight">
                          {rashiLines[srcLineIdx1 - 1]}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Linked Commentary Lines Stacked (7 Cols) */}
                  <div className="md:col-span-7 space-y-2">
                    <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center justify-between">
                      <span>פירושים מקושרים ({linkedCommLinks.length})</span>
                      {isDragOver && (
                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs">
                          השלך כאן כדי לקשר
                        </span>
                      )}
                    </div>

                    {linkedCommLinks.length === 0 ? (
                      <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-800 text-center text-[11px] text-slate-400">
                        אין פירוש מקושר לשורה זו. גרור פירוש לכאן.
                      </div>
                    ) : (
                      linkedCommLinks.map(l => renderCommentaryBox(l))
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Bottom Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <button
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 disabled:opacity-40 rounded-lg border border-slate-300 dark:border-slate-800 shadow-xs"
              >
                ← עמוד קודם
              </button>
              <span>
                עמוד {currentPage} מתוך {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 disabled:opacity-40 rounded-lg border border-slate-300 dark:border-slate-800 shadow-xs"
              >
                עמוד הבא →
              </button>
            </div>
          )}
        </div>

        {/* Unlinked Commentary Standalone Pane Column (4 cols) */}
        <div className="lg:col-span-4 space-y-3 sticky top-16">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropUnlink}
            className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 space-y-3 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>פירושים ללא מקור מקושר ({unlinkedCommLines.length})</span>
              </h3>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              שורות אלו יוצגו ברקע אדום שקוף עדין לציון חוסר התאמה. ניתן לגרור שורה לכרטיסיית מקור משמאל.
            </p>

            {unlinkedCommLines.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                ✓ כל שורות הפירוש מקושרות בהצלחה!
              </div>
            ) : (
              unlinkedCommLines.map(un => renderCommentaryBox(undefined, un.lineIndex1))
            )}
          </div>
        </div>
      </div>

      {/* Edit Link Modal */}
      {editingCommLineIdx !== null && (
        <EditLinkModal
          commLineIndex={editingCommLineIdx}
          commLineText={commentaryLines[editingCommLineIdx - 1] || ''}
          currentLink={links.find(l => l.line_index_1 === editingCommLineIdx)}
          sourceLinesCount={sourceLines.length}
          isShas={config.sourceCategory === 'shas'}
          onSave={handleSaveLink}
          onClose={() => setEditingCommLineIdx(null)}
        />
      )}
    </div>
  );
};
