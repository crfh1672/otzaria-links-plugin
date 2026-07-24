import React, { useState } from 'react';
import { SessionState, OtzariaLink, DHHighlight } from '../types';
import { formatLineWithDH, parseDocumentSegments } from '../utils/parserAlgorithm';
import { EditLinkModal } from './EditLinkModal';
import {
  Edit3,
  Plus,
  Minus,
  GripVertical,
  Link2Off,
  Layers,
  AlertTriangle,
  Info,
  Eye,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldCheck,
  CheckSquare,
  Sparkles,
  X
} from 'lucide-react';

const CollapsibleText = ({ text, isPrimary }: { text: string; isPrimary: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(isPrimary);

  if (isPrimary || !text || text.length <= 150) {
    return (
      <p className="text-sm md:text-base font-sans leading-relaxed text-[var(--color-on-surface)] bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 md:p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
        {text}
      </p>
    );
  }

  return (
    <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 md:p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 space-y-2">
      <p className={`text-sm md:text-base font-sans leading-relaxed text-[var(--color-on-surface)] ${!isExpanded ? 'line-clamp-3' : ''}`}>
        {text}
      </p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-[var(--color-primary)] hover:underline font-bold"
      >
        {isExpanded ? 'צמצם' : 'הרחב'}
      </button>
    </div>
  );
};

interface EditModeProps {
  session: SessionState;
  onUpdateSession: (updated: SessionState) => void;
}

export const EditMode: React.FC<EditModeProps> = ({ session, onUpdateSession }) => {
  const [editingCommLineIdx, setEditingCommLineIdx] = useState<number | null>(null);
  const [draggedCommLineIdx, setDraggedCommLineIdx] = useState<number | null>(null);

  // Pagination & Filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(40);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'linked' | 'unlinked' | 'high_confidence' | 'low_confidence' | 'pending'>('all');
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | 'all'>('all');

  // Floating Warning Widget state
  const [isUnlinkedDrawerOpen, setIsUnlinkedDrawerOpen] = useState(false);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  // Bulk actions for confidence & approval
  const handleApproveAllHighConfidence = () => {
    const updatedLinks = session.links.map(l => {
      const conf = l.confidence ?? 85;
      if (conf >= 80) {
        return { ...l, status: 'approved' as ('approved' | 'pending') };
      }
      return l;
    });
    onUpdateSession({
      ...session,
      links: updatedLinks,
      lastModifiedTimestamp: Date.now()
    });
  };

  const handleToggleLinkApproval = (commLineIdx1: number) => {
    const updatedLinks = session.links.map(l => {
      if (l.line_index_1 === commLineIdx1) {
        const currentStatus = l.status || 'approved';
        const nextStatus: 'approved' | 'pending' = currentStatus === 'approved' ? 'pending' : 'approved';
        return { ...l, status: nextStatus };
      }
      return l;
    });
    onUpdateSession({
      ...session,
      links: updatedLinks,
      lastModifiedTimestamp: Date.now()
    });
  };

  const {
    commentaryLines,
    sourceLines,
    rashiLines,
    tosafotLines,
    links,
    dhHighlights = {},
    config
  } = session;

  const rashiLinksBySecondaryLine = React.useMemo(() => {
    const map: Record<number, OtzariaLink[]> = {};
    links.forEach(link => {
      if (link.secondaryTarget === 'rashi' && link.secondary_line_index) {
        if (!map[link.secondary_line_index]) {
          map[link.secondary_line_index] = [];
        }
        map[link.secondary_line_index].push(link);
      }
    });
    return map;
  }, [links]);

  const rashiLinksWithoutLine = React.useMemo(() => {
    return links.filter(link => link.secondaryTarget === 'rashi' && !link.secondary_line_index);
  }, [links]);

  const tosafotLinksBySecondaryLine = React.useMemo(() => {
    const map: Record<number, OtzariaLink[]> = {};
    links.forEach(link => {
      if (link.secondaryTarget === 'tosafot' && link.secondary_line_index) {
        if (!map[link.secondary_line_index]) {
          map[link.secondary_line_index] = [];
        }
        map[link.secondary_line_index].push(link);
      }
    });
    return map;
  }, [links]);

  const tosafotLinksWithoutLine = React.useMemo(() => {
    return links.filter(link => link.secondaryTarget === 'tosafot' && !link.secondary_line_index);
  }, [links]);

  // Set of linked commentary line indices (1-based)
  const linkedCommLineIndices = React.useMemo(() => {
    return new Set(links.map(l => l.line_index_1));
  }, [links]);

  // Unlinked commentary lines
  const unlinkedCommLines = React.useMemo(() => {
    const unlinked: { lineIndex1: number; text: string }[] = [];
    commentaryLines.forEach((line, idx) => {
      const lineIdx1 = idx + 1; // 1-based
      if (!line.trim() || /<h[1-6][^>]*>.*<\/h[1-6]>/i.test(line) || /^#{1,6}\s+/.test(line)) {
        return;
      }
      if (!linkedCommLineIndices.has(lineIdx1)) {
        unlinked.push({ lineIndex1: lineIdx1, text: line });
      }
    });
    return unlinked;
  }, [commentaryLines, linkedCommLineIndices]);

  const commentarySegments = React.useMemo(() => {
    return parseDocumentSegments(commentaryLines.join('\n')).segments;
  }, [commentaryLines]);

  // Filtered commentary line array indices
  const filteredCommentaryIndices = React.useMemo(() => {
    const indices: number[] = [];
    const q = sourceSearchQuery.toLowerCase().trim();
    const currentSeg = selectedSegmentIndex !== 'all' ? commentarySegments[selectedSegmentIndex] : null;

    commentaryLines.forEach((line, idx) => {
      const commLineIdx1 = idx + 1;

      if (!line.trim() || /<h[1-6][^>]*>.*<\/h[1-6]>/i.test(line) || /^#{1,6}\s+/.test(line)) {
        return;
      }

      if (currentSeg && (commLineIdx1 < currentSeg.startLine || commLineIdx1 > currentSeg.endLine)) {
        return;
      }

      const link = links.find(l => l.line_index_1 === commLineIdx1);

      if (filterMode === 'linked' && !link) return;
      if (filterMode === 'unlinked' && link) return;
      if (filterMode === 'high_confidence') {
        if (!link || (link.confidence ?? 85) < 80) return;
      }
      if (filterMode === 'low_confidence') {
        if (!link || (link.confidence ?? 85) >= 80) return;
      }
      if (filterMode === 'pending') {
        if (!link || link.status === 'approved') return;
      }

      if (q) {
        const lineMatches = line.toLowerCase().includes(q) || commLineIdx1.toString() === q;
        let targetMatches = false;

        if (link && !link.secondaryTarget && sourceLines[link.line_index_2 - 1]) {
          targetMatches = sourceLines[link.line_index_2 - 1].toLowerCase().includes(q);
        }

        if (!lineMatches && !targetMatches) return;
      }

      indices.push(idx);
    });

    return indices;
  }, [commentaryLines, links, filterMode, sourceSearchQuery, sourceLines, selectedSegmentIndex, commentarySegments]);

  const totalPages = Math.max(1, Math.ceil(filteredCommentaryIndices.length / pageSize));

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredCommentaryIndices.length, totalPages, currentPage]);

  const currentPageIndices = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCommentaryIndices.slice(start, start + pageSize);
  }, [filteredCommentaryIndices, currentPage, pageSize]);

  const currentPageGroups = React.useMemo(() => {
    const groups: {
      targetKey: string;
      commIndices: number[];
      links: (OtzariaLink | undefined)[];
      isUnlinked: boolean;
      secondaryTarget?: 'rashi' | 'tosafot';
      secondaryLineIndex?: number;
      primaryLineIndex?: number;
    }[] = [];

    currentPageIndices.forEach(idx => {
      const commLineIdx1 = idx + 1;
      const linkObj = links.find(l => l.line_index_1 === commLineIdx1);

      const targetKey = linkObj
        ? (linkObj.secondaryTarget ? `${linkObj.secondaryTarget}-${linkObj.secondary_line_index}` : `primary-${linkObj.line_index_2}`)
        : `unlinked-${commLineIdx1}`;

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.targetKey === targetKey && targetKey !== `unlinked-${commLineIdx1}`) {
        lastGroup.commIndices.push(commLineIdx1);
        lastGroup.links.push(linkObj);
      } else {
        groups.push({
          targetKey,
          commIndices: [commLineIdx1],
          links: [linkObj],
          isUnlinked: !linkObj,
          secondaryTarget: linkObj?.secondaryTarget,
          secondaryLineIndex: linkObj?.secondary_line_index,
          primaryLineIndex: linkObj?.line_index_2
        });
      }
    });

    return groups;
  }, [currentPageIndices, links]);

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

    updatedLinks = updatedLinks.filter(l => l.line_index_1 !== commLineIdx1);

    if (newSourceLineIdx && newSourceLineIdx >= 1) {
      if (!secondaryTarget && newSourceLineIdx > sourceLines.length) return;

      const headerTitle = config.targetBookName;
      const isSecondary = Boolean(secondaryTarget);

      const getSecondaryPath = (sec: 'rashi' | 'tosafot', title: string) =>
        sec === 'rashi' ? `רש"י על ${title}.txt` : `תוספות על ${title}.txt`;
      const getSecondaryBookLabel = (sec: 'rashi' | 'tosafot') =>
        sec === 'rashi' ? 'רש"י' : 'תוספות';

      const path_2 = isSecondary
        ? getSecondaryPath(secondaryTarget!, config.targetBookName)
        : `${config.targetBookName}.txt`;

      const heRef_2 = isSecondary
        ? `${getSecondaryBookLabel(secondaryTarget!)} - ${headerTitle}`
        : `${headerTitle} - שורה ${newSourceLineIdx}`;

      const newLink: OtzariaLink = {
        line_index_1: commLineIdx1,
        line_index_2: newSourceLineIdx,
        heRef_2: heRef_2,
        path_2: path_2,
        connection_type: "commentary",
        secondaryTarget: secondaryTarget,
        secondary_line_index: isSecondary ? newSourceLineIdx : undefined,
        secondaryRef: isSecondary ? `${getSecondaryBookLabel(secondaryTarget!)} (${headerTitle})` : undefined,
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

  const handleDragStart = (commLineIdx1: number) => {
    setDraggedCommLineIdx(commLineIdx1);
  };

  // Render a commentary line box
  const renderCommentaryBox = (linkObj?: OtzariaLink, commIdx1?: number) => {
    const lineIdx1 = linkObj ? linkObj.line_index_1 : commIdx1!;
    const rawLineText = commentaryLines[lineIdx1 - 1] || '';
    const highlight = dhHighlights[lineIdx1] || { wordStart: 0, wordCount: 3 };

    const isUnlinked = !linkObj;
    const isInherited = linkObj?.isInherited;

    let bgStyle = "bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)] border-[var(--color-outline)]";
    if (isUnlinked) {
      bgStyle = "bg-rose-50/80 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 border-rose-300/80 dark:border-rose-900/60";
    } else if (isInherited) {
      bgStyle = "bg-[var(--color-primary-subtle)] text-[var(--color-on-surface)] border-[var(--color-outline)]";
    }

    const formattedHtml = formatLineWithDH(rawLineText, highlight);

    return (
      <div
        key={`comm-${lineIdx1}`}
        draggable
        onDragStart={() => handleDragStart(lineIdx1)}
        className={`group relative p-4 md:p-5 rounded-2xl border shadow-2xs transition-all ${bgStyle} hover:shadow-xs hover:border-[var(--color-primary)] space-y-2.5`}
      >
        {/* Top Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-on-surface-variant)]">
          <div className="flex flex-wrap items-center gap-2 font-mono font-bold text-xs md:text-sm">
            <GripVertical className="w-4 h-4 text-[var(--color-on-surface-variant)] cursor-grab active:cursor-grabbing opacity-70" />
            <span>שורה {lineIdx1}</span>
            {isInherited && (
              <span className="bg-[var(--color-primary)] text-[var(--color-on-primary)] text-xs px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                <span>ירושת הקשר</span>
              </span>
            )}
            {isUnlinked && (
              <span className="bg-rose-200/90 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100 text-xs px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ללא מקור מקושר</span>
              </span>
            )}

            {/* Confidence Score & Approval Badge */}
            {linkObj && (
              <button
                type="button"
                onClick={() => handleToggleLinkApproval(lineIdx1)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl font-bold border transition-colors ${
                  (linkObj.status === 'approved' || !linkObj.status)
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
                }`}
                title="לחץ לשינוי סטטוס אישור הקישור"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${(linkObj.status === 'approved' || !linkObj.status) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`} />
                <span>{(linkObj.status === 'approved' || !linkObj.status) ? 'מאושר' : 'ממתין לבדיקה'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  (linkObj.confidence ?? 85) >= 80
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : (linkObj.confidence ?? 85) >= 65
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                }`}>
                  {linkObj.confidence ?? 85}% ודאות
                </span>
              </button>
            )}
          </div>

          {/* Floating Actions */}
          <div className="opacity-90 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
            {/* DH Word Highlight Controls */}
            <div className="flex items-center gap-1 bg-[var(--color-surface)] p-1 rounded-xl border border-[var(--color-outline)]">
              <span className="text-xs font-medium text-[var(--color-on-surface-variant)] px-1.5">
                ד"ה ({highlight.wordCount} מילים)
              </span>
              <button
                type="button"
                onClick={() => handleAdjustDH(lineIdx1, 1)}
                className="p-1 hover:bg-[var(--color-secondary-subtle)] rounded-lg text-[var(--color-primary)]"
                title="הוסף מילה להדגשת דיבור המתחיל"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDH(lineIdx1, -1)}
                className="p-1 hover:bg-[var(--color-secondary-subtle)] rounded-lg text-rose-600 dark:text-rose-400"
                title="הסר מילה מהדגשת דיבור המתחיל"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Direct Edit Button */}
            <button
              onClick={() => setEditingCommLineIdx(lineIdx1)}
              className="p-1.5 hover:bg-[var(--color-primary-subtle)] text-[var(--color-primary)] rounded-xl transition-colors border border-transparent hover:border-[var(--color-outline)]"
              title="ערוך קישור ידנית"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {!isUnlinked && (
              <button
                onClick={() => handleSaveLink(lineIdx1, null)}
                className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl transition-colors border border-transparent hover:border-rose-200"
                title="נתק קישור"
              >
                <Link2Off className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Text with <b> highlighting */}
        <div
          className="text-sm md:text-base font-sans leading-relaxed text-[var(--color-on-surface)] [&_b]:font-bold [&_b]:text-[var(--color-primary)] [&_b]:bg-[var(--color-primary-subtle)] [&_b]:px-1.5 [&_b]:py-0.5 [&_b]:rounded-md"
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 text-right" dir="rtl">
      {/* Search & Filter Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-outline-variant)] shadow-2xs">
        {/* Search & Chapter filter bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={sourceSearchQuery}
              onChange={e => {
                setSourceSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="סינון/חיפוש בשורות מקור או פירוש..."
              className="w-full pl-3 pr-4 py-2 text-sm bg-[var(--color-surface-container-low)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-sans"
            />
          </div>

          {commentarySegments.length > 1 && (
            <div className="flex items-center gap-1.5 bg-[var(--color-surface-container-low)] px-3 py-1.5 rounded-xl border border-[var(--color-outline)] text-xs">
              <BookOpen className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
              <span className="font-bold text-[var(--color-on-surface-variant)] shrink-0">סנן לפי פרק/כותרת:</span>
              <select
                value={selectedSegmentIndex}
                onChange={(e) => {
                  setSelectedSegmentIndex(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent font-bold text-[var(--color-on-surface)] focus:outline-none cursor-pointer py-0.5"
              >
                <option value="all">כל הפרקים ({commentarySegments.length})</option>
                {commentarySegments.map((seg, idx) => (
                  <option key={idx} value={idx}>
                    {seg.headerTitle} (שורות {seg.startLine}-{seg.endLine})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter mode toggles */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[var(--color-surface-container-low)] p-1 rounded-xl border border-[var(--color-outline)]">
          <button
            onClick={() => {
              setFilterMode('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterMode === 'all'
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)]'
            }`}
          >
            הצג הכל
          </button>
          <button
            onClick={() => {
              setFilterMode('high_confidence');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterMode === 'high_confidence'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            ודאות גבוהה (≥80%)
          </button>
          <button
            onClick={() => {
              setFilterMode('pending');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterMode === 'pending'
                ? 'bg-amber-600 text-white'
                : 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            ממתינים לבדיקה
          </button>
          <button
            onClick={() => {
              setFilterMode('unlinked');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterMode === 'unlinked'
                ? 'bg-rose-600 text-white'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            ללא מקור ({unlinkedCommLines.length})
          </button>
        </div>

        {/* Bulk Approval Button */}
        <button
          type="button"
          onClick={handleApproveAllHighConfidence}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          title="מאשר מראש את כל הקישורים עם ציון ודאות של 80% ומעלה"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>אישור גורף (ודאות ≥80%)</span>
        </button>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-on-surface)]">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-[var(--color-surface-container-low)] hover:bg-[var(--color-outline-variant)] disabled:opacity-40 rounded-xl border border-[var(--color-outline)] font-bold"
            >
              הקודם
            </button>
            <span className="font-bold">
              עמוד {currentPage} מתוך {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-[var(--color-surface-container-low)] hover:bg-[var(--color-outline-variant)] disabled:opacity-40 rounded-xl border border-[var(--color-outline)] font-bold"
            >
              הבא
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-on-surface-variant)] px-1 font-medium">
        <span>
          מציג {currentPageIndices.length} שורות פירוש (סה"כ {filteredCommentaryIndices.length})
        </span>
      </div>

      {/* Main Unified List */}
      <div className="space-y-4">
        {currentPageGroups.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--color-on-surface-variant)] bg-[var(--color-surface)] rounded-2xl border border-dashed border-[var(--color-outline)] font-medium">
            לא נמצאו שורות פירוש המתאימות לסינון המבוקש
          </div>
        ) : (
          currentPageGroups.map((group, gIdx) => {
            const firstLinkObj = group.links[0];

            return (
              <div
                key={`comm-group-${group.targetKey}-${gIdx}`}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 rounded-2xl border bg-[var(--color-surface)] border-[var(--color-outline-variant)] shadow-2xs transition-all"
              >
                {/* Primary Commentary Lines (7 Cols) */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--color-primary)]">
                    <span>פירושים ({group.commIndices.length})</span>
                  </div>
                  {group.links.map((linkObj, idx) => (
                    renderCommentaryBox(linkObj, group.commIndices[idx])
                  ))}
                </div>

                {/* Target Source Line (5 Cols) */}
                <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-[var(--color-outline)] pt-4 md:pt-0 pl-0 md:pl-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {firstLinkObj ? (
                      <>
                        <span className="font-bold">
                          מקור: {firstLinkObj.secondaryTarget ? (firstLinkObj.secondaryTarget === 'rashi' ? 'רש"י' : 'תוספות') : config.targetBookName} (שורה {firstLinkObj.secondaryTarget ? firstLinkObj.secondary_line_index : firstLinkObj.line_index_2})
                        </span>
                        <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md text-emerald-800 dark:text-emerald-300 font-bold max-w-[180px] truncate" title={firstLinkObj.secondaryRef || firstLinkObj.heRef_2 || firstLinkObj.path_2}>
                          {firstLinkObj.secondaryRef || firstLinkObj.heRef_2 || (firstLinkObj.secondaryTarget ? (firstLinkObj.secondaryTarget === 'rashi' ? 'רש"י' : 'תוספות') : config.targetBookName)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>מקור מקושר</span>
                        <span className="text-xs bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-md text-rose-800 dark:text-rose-300 font-bold">
                          ללא מקור
                        </span>
                      </>
                    )}
                  </div>

                  {firstLinkObj ? (
                    <CollapsibleText
                      text={firstLinkObj.secondaryTarget
                        ? (firstLinkObj.secondaryTarget === 'rashi'
                            ? (rashiLines && rashiLines[firstLinkObj.secondary_line_index! - 1] || '')
                            : (tosafotLines && tosafotLines[firstLinkObj.secondary_line_index! - 1] || ''))
                        : (sourceLines && sourceLines[firstLinkObj.line_index_2 - 1] || '')}
                      isPrimary={!firstLinkObj.secondaryTarget}
                    />
                  ) : (
                    <div className="p-5 rounded-xl border border-dashed border-[var(--color-outline)] text-center text-xs text-[var(--color-on-surface-variant)]">
                      אין מקור מקושר. לחץ על כפתור העריכה בכרטיס הפירוש כדי לקשר.
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Secondary Sources Section */}
        {(((rashiLines && (Object.keys(rashiLinksBySecondaryLine).length > 0 || rashiLinksWithoutLine.length > 0)) || (tosafotLines && (Object.keys(tosafotLinksBySecondaryLine).length > 0 || tosafotLinksWithoutLine.length > 0)))) && (
          <div className="space-y-4 pt-6">
            <div className="text-base font-bold text-[var(--color-on-surface)]">מקורות משניים</div>
            {['rashi', 'tosafot'].map(target => {
              const targetName = target === 'rashi' ? 'רש"י' : 'תוספות';
              const lines = target === 'rashi' ? rashiLines : tosafotLines;
              const linksByLine = target === 'rashi' ? rashiLinksBySecondaryLine : tosafotLinksBySecondaryLine;
              const linksWithoutLine = target === 'rashi' ? rashiLinksWithoutLine : tosafotLinksWithoutLine;
              const lineIndices = Object.keys(linksByLine).map(key => Number(key)).sort((a, b) => a - b);

              if (!lines && linksWithoutLine.length === 0) return null;

              return (
                <div key={target} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                    <span>מקור משני: {targetName}</span>
                  </div>
                  {lineIndices.map(lineIdx => {
                    const secLine = lines?.[lineIdx - 1] || '';
                    const linkedCommLinks = linksByLine[lineIdx] || [];

                    return (
                      <div key={`${target}-line-${lineIdx}`} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 rounded-2xl border bg-[var(--color-surface)] border-[var(--color-outline-variant)] shadow-2xs">
                        <div className="md:col-span-5 border-l-0 md:border-l border-[var(--color-outline)] pl-0 md:pl-4 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                            <span>{targetName} - שורה {lineIdx}</span>
                            <span className="text-xs bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md text-amber-800 dark:text-amber-300 font-bold">
                              מקור משני
                            </span>
                          </div>
                          <CollapsibleText text={secLine} isPrimary={false} />
                        </div>
                        <div className="md:col-span-7 space-y-3">
                          <div className="text-xs font-bold text-[var(--color-secondary)] mb-1">
                            פירושים מקושרים ({linkedCommLinks.length})
                          </div>
                          {linkedCommLinks.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-[var(--color-outline)] text-center text-xs text-[var(--color-on-surface-variant)]">
                              אין פירוש מקושר לשורה זו.
                            </div>
                          ) : (
                            linkedCommLinks.map(l => renderCommentaryBox(l))
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {linksWithoutLine.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 p-5 rounded-2xl border bg-[var(--color-surface)] border-[var(--color-outline-variant)] shadow-2xs">
                      <div className="text-xs font-bold text-[var(--color-secondary)] mb-2">
                        קישורים משניים ללא שורה משויכת ב-{targetName}
                      </div>
                      {linksWithoutLine.map(link => renderCommentaryBox(link))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6 text-sm font-semibold text-[var(--color-on-surface)]">
            <button
              disabled={currentPage <= 1}
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-container-low)] disabled:opacity-40 rounded-xl border border-[var(--color-outline)] shadow-2xs font-bold"
            >
              ← עמוד קודם
            </button>
            <span className="font-bold">
              עמוד {currentPage} מתוך {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-container-low)] disabled:opacity-40 rounded-xl border border-[var(--color-outline)] shadow-2xs font-bold"
            >
              עמוד הבא →
            </button>
          </div>
        )}
      </div>

      {/* Floating Unlinked Lines Alert Widget */}
      <div className="fixed bottom-5 right-5 z-40 max-w-sm sm:max-w-md w-[calc(100%-2.5rem)] transition-all">
        {unlinkedCommLines.length > 0 ? (
          <div className="bg-[var(--color-surface)] border-2 border-rose-400 dark:border-rose-800 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md space-y-2.5">
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                <span>ישנן {unlinkedCommLines.length} שורות לא מקושרות</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsUnlinkedDrawerOpen(!isUnlinkedDrawerOpen)}
                  className="px-2.5 py-1 text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100 hover:bg-rose-200 dark:hover:bg-rose-900 rounded-xl transition-colors flex items-center gap-1"
                  title="הצג שורות לא מקושרות"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isUnlinkedDrawerOpen ? 'סגור' : 'הצג'}</span>
                </button>

                <button
                  onClick={() => {
                    setFilterMode(filterMode === 'unlinked' ? 'all' : 'unlinked');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-colors border ${
                    filterMode === 'unlinked'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)] border-[var(--color-outline)] hover:bg-[var(--color-outline-variant)]'
                  }`}
                >
                  {filterMode === 'unlinked' ? 'מציג לא מקושרים' : 'סנן'}
                </button>

                <button
                  onClick={() => setIsWidgetMinimized(!isWidgetMinimized)}
                  className="p-1 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-lg transition-colors"
                  title={isWidgetMinimized ? "הרחב חלונית" : "מזער חלונית"}
                >
                  {isWidgetMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Expanded Drawer list inside float */}
            {!isWidgetMinimized && isUnlinkedDrawerOpen && (
              <div className="pt-2.5 border-t border-[var(--color-outline)] space-y-2.5 max-h-72 overflow-y-auto pl-1">
                <p className="text-xs text-[var(--color-on-surface-variant)] mb-2 font-medium">
                  לחץ עריכה כדי לקשר שורות פירוש ללא מקור:
                </p>
                {unlinkedCommLines.map(un => renderCommentaryBox(undefined, un.lineIndex1))}
              </div>
            )}
          </div>
        ) : (
          !isWidgetMinimized && (
            <div className="bg-[var(--color-surface)] border border-emerald-400 dark:border-emerald-800 rounded-2xl p-3 shadow-xl backdrop-blur-md flex items-center justify-between gap-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>כל שורות הפירוש מקושרות בהצלחה!</span>
              </div>
              <button
                onClick={() => setIsWidgetMinimized(true)}
                className="p-1 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        )}
      </div>

      {/* Edit Link Modal */}
      {editingCommLineIdx !== null && (
        <EditLinkModal
          commLineIndex={editingCommLineIdx}
          commLineText={commentaryLines[editingCommLineIdx - 1] || ''}
          currentLink={links.find(l => l.line_index_1 === editingCommLineIdx)}
          sourceLinesCount={sourceLines.length}
          sourceLines={sourceLines}
          rashiLines={rashiLines}
          tosafotLines={tosafotLines}
          targetBookName={config.targetBookName}
          isShas={config.sourceCategory === 'shas'}
          onSave={handleSaveLink}
          onClose={() => setEditingCommLineIdx(null)}
        />
      )}
    </div>
  );
};
