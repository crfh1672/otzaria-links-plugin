import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  X,
  Bookmark,
  ListTree,
  Search
} from 'lucide-react';
import { HeaderSegment } from '../utils/parserAlgorithm';

import { findSourceMatchRange } from '../utils/parserAlgorithm';

const getTargetColors = (target?: 'rashi' | 'tosafot' | 'primary' | string) => {
  switch (target) {
    case 'rashi':
      return {
        text: 'text-orange-800 dark:text-orange-300',
        bgTitle: 'bg-orange-100 dark:bg-orange-950/60',
        bgPanel: 'bg-orange-50/40 dark:bg-orange-950/20',
        borderPanel: 'border-orange-100 dark:border-orange-900/30',
        lineStroke: '#f97316' // orange-500
      };
    case 'tosafot':
      return {
        text: 'text-purple-800 dark:text-purple-300',
        bgTitle: 'bg-purple-100 dark:bg-purple-950/60',
        bgPanel: 'bg-purple-50/40 dark:bg-purple-950/20',
        borderPanel: 'border-purple-100 dark:border-purple-900/30',
        lineStroke: '#a855f7' // purple-500
      };
    default:
      return {
        text: 'text-emerald-800 dark:text-emerald-300',
        bgTitle: 'bg-emerald-100 dark:bg-emerald-950/60',
        bgPanel: 'bg-emerald-50/40 dark:bg-emerald-950/20',
        borderPanel: 'border-emerald-100 dark:border-emerald-900/30',
        lineStroke: '#10b981' // emerald-500
      };
  }
};


const CollapsibleText = ({ text, isPrimary, links, targetType, onHoverMatch }: { text: string; isPrimary: boolean; links?: OtzariaLink[]; targetType?: 'rashi' | 'tosafot' | 'primary' | string; onHoverMatch?: (id: number | null) => void }) => {
  const [isExpanded, setIsExpanded] = useState(isPrimary);

  // Parse words and determine highlights if links are provided
  let contentNodes: React.ReactNode = text;
  
  if (links && links.length > 0) {
    const words = text.split(/(\s+)/);
    const actualWords: { text: string; wordIndex: number; arrayIndex: number }[] = [];
    let currentWordIdx = 0;
    
    for (let i = 0; i < words.length; i++) {
      if (words[i].trim().length > 0) {
        actualWords.push({ text: words[i], wordIndex: currentWordIdx, arrayIndex: i });
        currentWordIdx++;
      }
    }

    // Determine which words are highlighted by which link
    const highlightMap = new Map<number, string[]>(); // wordIndex -> array of link line_index_1
    links.forEach(link => {
      if (link.dhText) {
        const range = link.matchRange || findSourceMatchRange(text, link.dhText);
        if (range) {
          for (let i = 0; i < range.wordCount; i++) {
            const idx = range.wordStart + i;
            if (!highlightMap.has(idx)) highlightMap.set(idx, []);
            highlightMap.get(idx)!.push(link.line_index_1.toString());
          }
        }
      }
    });

    if (highlightMap.size > 0) {
      const nodes: React.ReactNode[] = [];
      let i = 0;
      while (i < words.length) {
        const isSpace = words[i].trim().length === 0;
        const actualWord = !isSpace ? actualWords.find(aw => aw.arrayIndex === i) : null;
        const isHighlighted = actualWord ? highlightMap.has(actualWord.wordIndex) : false;

        if (isHighlighted) {
          const seqWords: string[] = [];
          const linkIdsSet = new Set<string>();
          let j = i;

          while (j < words.length) {
            const subIsSpace = words[j].trim().length === 0;
            const subActualWord = !subIsSpace ? actualWords.find(aw => aw.arrayIndex === j) : null;
            const subIsHighlighted = subActualWord ? highlightMap.has(subActualWord.wordIndex) : false;

            if (subIsHighlighted) {
              seqWords.push(words[j]);
              highlightMap.get(subActualWord!.wordIndex)!.forEach(id => linkIdsSet.add(id));
              j++;
            } else if (subIsSpace) {
              let nextHighlighted = false;
              let peek = j + 1;
              while (peek < words.length) {
                const peekIsSpace = words[peek].trim().length === 0;
                if (!peekIsSpace) {
                  const peekActualWord = actualWords.find(aw => aw.arrayIndex === peek);
                  if (peekActualWord && highlightMap.has(peekActualWord.wordIndex)) {
                    nextHighlighted = true;
                  }
                  break;
                }
                peek++;
              }

              if (nextHighlighted) {
                seqWords.push(words[j]);
                j++;
              } else {
                break;
              }
            } else {
              break;
            }
          }

          const linkIdsStr = Array.from(linkIdsSet).join(' ');
          const firstHighlightWord = actualWords.find(aw => aw.arrayIndex === i);
          const uniqueId = firstHighlightWord ? `source-match-${linkIdsStr.split(' ')[0]}-${firstHighlightWord.wordIndex}` : `source-match-${linkIdsStr.split(' ')[0]}-${i}`;

          nodes.push(
            <mark
              key={`seq-${i}`}
              data-source-match-for={linkIdsStr}
              data-target-type={targetType || 'primary'}
              id={uniqueId}
              onMouseEnter={() => {
                const firstId = parseInt(linkIdsStr.split(' ')[0], 10);
                if (!isNaN(firstId) && onHoverMatch) {
                  onHoverMatch(firstId);
                }
              }}
              onMouseLeave={() => {
                if (onHoverMatch) onHoverMatch(null);
              }}
              className="bg-yellow-200/60 dark:bg-yellow-500/30 hover:bg-yellow-300 dark:hover:bg-yellow-400/50 border border-gray-400 dark:border-gray-600 rounded px-1.5 py-0.5 mx-0.5 transition-all duration-200 cursor-help"
            >
              {seqWords.join('')}
            </mark>
          );
          i = j;
        } else {
          nodes.push(<React.Fragment key={i}>{words[i]}</React.Fragment>);
          i++;
        }
      }
      contentNodes = nodes;
    }
  }

  if (isPrimary || !text || text.length <= 150) {
    const colors = getTargetColors(targetType);
    return (
      <p className={`text-sm md:text-base font-sans leading-relaxed text-[var(--color-on-surface)] ${colors.bgPanel} p-3.5 md:p-4 rounded-xl border ${colors.borderPanel}`}>
        {contentNodes}
      </p>
    );
  }

  const colors = getTargetColors(targetType);
  return (
    <div className={`${colors.bgPanel} p-3.5 md:p-4 rounded-xl border ${colors.borderPanel} space-y-2`}>
      <p className={`text-sm md:text-base font-sans leading-relaxed text-[var(--color-on-surface)] ${!isExpanded ? 'line-clamp-3' : ''}`}>
        {contentNodes}
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


const CollapsibleCommentary = ({ html }: { html: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="space-y-1">
      <div
        className={`text-sm md:text-base font-sans leading-relaxed text-[var(--color-on-surface)] [&_b]:font-bold [&_b]:text-[var(--color-primary)] [&_b]:bg-[var(--color-primary-subtle)] [&_b]:px-1.5 [&_b]:py-0.5 [&_b]:rounded-md ${!isExpanded ? 'line-clamp-2' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
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
  isNavDrawerOpen?: boolean;
  onCloseNavDrawer?: () => void;
  onToggleNavDrawer?: () => void;
  sortMode?: 'book_order' | 'score_asc' | 'score_desc';
}

export const EditMode: React.FC<EditModeProps> = ({
  session,
  onUpdateSession,
  isNavDrawerOpen,
  onCloseNavDrawer,
  onToggleNavDrawer,
  sortMode = 'book_order'
}) => {
  const [editingCommLineIdx, setEditingCommLineIdx] = useState<number | null>(null);
  const [draggedCommLineIdx, setDraggedCommLineIdx] = useState<number | null>(null);
  const [dragOverSourceIdx, setDragOverSourceIdx] = useState<number | null>(null);
  const [dragOverSourceType, setDragOverSourceType] = useState<'primary' | 'rashi' | 'tosafot' | null>(null);
  const [hoveredCommLineIdx, setHoveredCommLineIdx] = useState<number | null>(null);

  // Filtering & Drawer state
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [drawerTab, setDrawerTab] = useState<'nav' | 'search'>('nav');

  // Connection Lines State
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgLines, setSvgLines] = useState<{ id: string; x1: number; y1: number; x2: number; y2: number; color?: string }[]>([]);

  const updateSvgLines = useCallback(() => {
    if (!containerRef.current) return;
    
    // Hide visual connection lines on mobile screens where columns stack vertically
    if (window.innerWidth < 768) {
      setSvgLines([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: { id: string; x1: number; y1: number; x2: number; y2: number; color?: string }[] = [];

    const commMarks = containerRef.current.querySelectorAll('mark[id^="comm-match-"]');
    commMarks.forEach(commMark => {
      const commId = commMark.id; 
      const lineIdx1Str = commId.split('-')[2];
      const lineIdx1 = parseInt(lineIdx1Str, 10);

      // Do not draw connecting line for inherited links
      const linkObj = session.links.find(l => l.line_index_1 === lineIdx1 || l.line_index_1.toString() === lineIdx1Str);
      if (linkObj?.isInherited) {
        return;
      }
      
      const sourceMarks = containerRef.current!.querySelectorAll(`mark[data-source-match-for~="${lineIdx1}"]`);
      if (sourceMarks.length > 0) {
        const commBox = containerRef.current!.querySelector(`#comm-box-${lineIdx1}`);
        if (!commBox) return;
        const commBoxRect = commBox.getBoundingClientRect();
        
        let srcTop = Infinity, srcBottom = -Infinity, srcLeft = Infinity, srcRight = -Infinity;
        sourceMarks.forEach(m => {
           const r = m.getBoundingClientRect();
           srcTop = Math.min(srcTop, r.top);
           srcBottom = Math.max(srcBottom, r.bottom);
           srcLeft = Math.min(srcLeft, r.left);
           srcRight = Math.max(srcRight, r.right);
        });

        // Draw from the commentary box container left edge (facing left column in RTL layout)
        // to the right edge of the matched words in the source column (facing right column)
        const x1 = commBoxRect.left - containerRect.left;
        const y1 = commBoxRect.top + commBoxRect.height / 2 - containerRect.top;

        const x2 = srcRight - containerRect.left;
        const y2 = (srcTop + srcBottom) / 2 - containerRect.top;

        const targetType = sourceMarks[0].getAttribute('data-target-type');
        const color = getTargetColors(targetType || 'primary').lineStroke;

        newLines.push({
          id: `line-${lineIdx1}`,
          x1, y1, x2, y2, color
        });
      }
    });
    setSvgLines(newLines);
  }, [session.links, session.dhHighlights]);

  useEffect(() => {
    const t = setTimeout(updateSvgLines, 100);
    window.addEventListener('resize', updateSvgLines);
    
    let observer: ResizeObserver | null = null;
    if (containerRef.current) {
      observer = new ResizeObserver(() => {
        updateSvgLines();
      });
      // Observe all children (the cards) to react to expansions
      Array.from(containerRef.current.children).forEach(child => {
        if (child.tagName !== 'svg') {
          observer!.observe(child);
        }
      });
    }

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateSvgLines);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [updateSvgLines, sortMode]);

  // Navigation Drawer & Section Heading Highlight state
  const [highlightedHeaderId, setHighlightedHeaderId] = useState<string | null>(null);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState('');

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

  // Cycle to the next Top-K candidate for a given commentary line.
  // Each call advances candidateIndex by 1 (wrapping around).
  // line_index_2 is updated to the newly selected candidate's lineNum.
  const handleCycleCandidate = (commLineIdx1: number) => {
    const updatedLinks = session.links.map(l => {
      if (l.line_index_1 !== commLineIdx1) return l;
      if (!l.candidates || l.candidates.length <= 1) return l;

      const nextIdx = ((l.candidateIndex ?? 0) + 1) % l.candidates.length;
      const nextCandidate = l.candidates[nextIdx];

      return {
        ...l,
        line_index_2: nextCandidate.lineNum,
        candidateIndex: nextIdx,
        confidence: nextCandidate.confidence,
        // Mark as pending when user cycles — they should review the new candidate
        status: 'pending' as const
      };
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

  const rashiLinksBySecondaryLine = useMemo(() => {
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

  const rashiLinksWithoutLine = useMemo(() => {
    return links.filter(link => link.secondaryTarget === 'rashi' && !link.secondary_line_index);
  }, [links]);

  const tosafotLinksBySecondaryLine = useMemo(() => {
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

  const tosafotLinksWithoutLine = useMemo(() => {
    return links.filter(link => link.secondaryTarget === 'tosafot' && !link.secondary_line_index);
  }, [links]);

  // Set of linked commentary line indices (1-based)
  const linkedCommLineIndices = useMemo(() => {
    return new Set(links.map(l => l.line_index_1));
  }, [links]);

  // Unlinked commentary lines
  const unlinkedCommLines = useMemo(() => {
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

  const commentarySegments = useMemo(() => {
    return parseDocumentSegments(commentaryLines.join('\n')).segments;
  }, [commentaryLines]);

  const filteredDrawerSegments = useMemo(() => {
    if (!drawerSearchQuery.trim()) return commentarySegments;
    const q = drawerSearchQuery.toLowerCase().trim();
    return commentarySegments.filter(seg =>
      seg.headerTitle.toLowerCase().includes(q) ||
      `שורות ${seg.startLine}-${seg.endLine}`.includes(q)
    );
  }, [commentarySegments, drawerSearchQuery]);

  const handleSelectHeading = (seg: HeaderSegment) => {
    // Find target line index for the segment
    const targetLineIdx1 = seg.headerLineIndex > 0 ? seg.headerLineIndex : seg.startLine;

    // Find target index in sortedCommentaryIndices
    let targetItemIdx = sortedCommentaryIndices.findIndex(lineArrIdx => (lineArrIdx + 1) >= seg.startLine);
    if (targetItemIdx === -1 && sortedCommentaryIndices.length > 0) {
      targetItemIdx = 0;
    }


    const headerId = seg.headerLineIndex > 0 ? `header-${seg.headerLineIndex}` : `header-start-${seg.startLine}`;
    setHighlightedHeaderId(headerId);

    setTimeout(() => {
      const el = document.getElementById(headerId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    setTimeout(() => {
      setHighlightedHeaderId(null);
    }, 3000);

    if (onCloseNavDrawer) {
      onCloseNavDrawer();
    }
  };

  
  const sortedCommentaryIndices = useMemo(() => {
    const indices: number[] = [];
    const q = sourceSearchQuery.toLowerCase().trim();

    commentaryLines.forEach((line, idx) => {
      const commLineIdx1 = idx + 1;
      if (!line.trim() || /<h[1-6][^>]*>.*<\/h[1-6]>/i.test(line) || /^#{1,6}\s+/.test(line)) {
        return;
      }
      
      const link = links.find(l => l.line_index_1 === commLineIdx1);

      if (q) {
        let lineMatches = line.toLowerCase().includes(q) || commLineIdx1.toString() === q;
        let targetMatches = false;
        if (link) {
          const targetLine = link.secondaryTarget === 'rashi' 
            ? rashiLines[link.secondary_line_index! - 1]
            : link.secondaryTarget === 'tosafot'
              ? tosafotLines[link.secondary_line_index! - 1]
              : sourceLines[link.line_index_2 - 1];
          if (targetLine && targetLine.toLowerCase().includes(q)) targetMatches = true;
        }
        if (!lineMatches && !targetMatches) return;
      }
      
      indices.push(idx); // idx is 0-based index
    });

    if (sortMode !== 'book_order') {
       indices.sort((idxA, idxB) => {
           const a = idxA + 1;
           const b = idxB + 1;
           const linkA = links.find(l => l.line_index_1 === a);
           const linkB = links.find(l => l.line_index_1 === b);
           const scoreA = linkA ? (linkA.confidence ?? 85) : 0;
           const scoreB = linkB ? (linkB.confidence ?? 85) : 0;
           if (sortMode === 'score_asc') return scoreA - scoreB;
           return scoreB - scoreA;
       });
    }

    return indices;
  }, [commentaryLines, links, sourceSearchQuery, sortMode, sourceLines, rashiLines, tosafotLines]);

  const groupedCommentary = useMemo(() => {
    const groups: {
      targetKey: string;
      commIndices: number[];
      links: (OtzariaLink | undefined)[];
      isUnlinked: boolean;
      secondaryTarget?: 'rashi' | 'tosafot';
      secondaryLineIndex?: number;
      primaryLineIndex?: number;
    }[] = [];

    sortedCommentaryIndices.forEach(idx => {
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
  }, [sortedCommentaryIndices, links]);

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

  const floatingSourceLines = useMemo(() => {
    if (draggedCommLineIdx === null) return [];

    const currentLink = links.find(l => l.line_index_1 === draggedCommLineIdx || l.line_index_1.toString() === draggedCommLineIdx.toString());
    const results: { index: number; text: string; targetType: 'primary' | 'rashi' | 'tosafot'; targetLabel: string; isCurrent: boolean }[] = [];

    // 1. Primary Source lines around target
    const primTarget = (currentLink && !currentLink.secondaryTarget)
      ? currentLink.line_index_2 
      : Math.max(1, Math.min(sourceLines.length, Math.floor((draggedCommLineIdx / commentaryLines.length) * sourceLines.length)));
    const primStart = Math.max(1, primTarget - 4);
    const primEnd = Math.min(sourceLines.length, primTarget + 4);
    for (let i = primStart; i <= primEnd; i++) {
      results.push({
        index: i,
        text: sourceLines[i - 1] || '',
        targetType: 'primary',
        targetLabel: config.targetBookName,
        isCurrent: !currentLink?.secondaryTarget && currentLink?.line_index_2 === i
      });
    }

    // 2. Rashi lines around target if rashiLines exists
    if (rashiLines && rashiLines.length > 0) {
      const rashiTarget = currentLink?.secondaryTarget === 'rashi' 
        ? currentLink.secondary_line_index! 
        : Math.max(1, Math.min(rashiLines.length, Math.floor((draggedCommLineIdx / commentaryLines.length) * rashiLines.length)));
      const rashiStart = Math.max(1, rashiTarget - 3);
      const rashiEnd = Math.min(rashiLines.length, rashiTarget + 3);
      for (let i = rashiStart; i <= rashiEnd; i++) {
        results.push({
          index: i,
          text: rashiLines[i - 1] || '',
          targetType: 'rashi',
          targetLabel: 'רש"י',
          isCurrent: currentLink?.secondaryTarget === 'rashi' && currentLink?.secondary_line_index === i
        });
      }
    }

    // 3. Tosafot lines around target if tosafotLines exists
    if (tosafotLines && tosafotLines.length > 0) {
      const tosafotTarget = currentLink?.secondaryTarget === 'tosafot' 
        ? currentLink.secondary_line_index! 
        : Math.max(1, Math.min(tosafotLines.length, Math.floor((draggedCommLineIdx / commentaryLines.length) * tosafotLines.length)));
      const tosafotStart = Math.max(1, tosafotTarget - 3);
      const tosafotEnd = Math.min(tosafotLines.length, tosafotTarget + 3);
      for (let i = tosafotStart; i <= tosafotEnd; i++) {
        results.push({
          index: i,
          text: tosafotLines[i - 1] || '',
          targetType: 'tosafot',
          targetLabel: 'תוספות',
          isCurrent: currentLink?.secondaryTarget === 'tosafot' && currentLink?.secondary_line_index === i
        });
      }
    }

    return results;
  }, [draggedCommLineIdx, links, sourceLines, rashiLines, tosafotLines, config.targetBookName, commentaryLines.length]);

  const handleDropOnSourceLine = (srcLineIdx: number, targetType: 'primary' | 'rashi' | 'tosafot') => {
    if (draggedCommLineIdx === null) return;
    const secTarget = targetType === 'primary' ? undefined : targetType;
    handleSaveLink(draggedCommLineIdx, srcLineIdx, secTarget);
    setDraggedCommLineIdx(null);
    setDragOverSourceIdx(null);
    setDragOverSourceType(null);
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

    const formattedHtml = formatLineWithDH(rawLineText, highlight, `comm-match-${lineIdx1}`, false);

    return (
      <div
        id={`comm-box-${lineIdx1}`}
        key={`comm-${lineIdx1}`}
        draggable
        onDragStart={() => handleDragStart(lineIdx1)}
        onDragEnd={() => setDraggedCommLineIdx(null)}
        onMouseEnter={() => setHoveredCommLineIdx(lineIdx1)}
        onMouseLeave={() => setHoveredCommLineIdx(null)}
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
                className={`inline-flex items-center justify-center p-1.5 rounded-xl font-bold border transition-colors ${
                  (linkObj.status === 'approved' || !linkObj.status)
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
                }`}
                title="לחץ לשינוי סטטוס אישור הקישור"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${(linkObj.status === 'approved' || !linkObj.status) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`} />
                
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
            {/* Cycle Top-K candidate button — only shown when multiple candidates exist */}
            {linkObj && linkObj.candidates && linkObj.candidates.length > 1 && (
              <button
                type="button"
                onClick={() => handleCycleCandidate(lineIdx1)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-xl hover:bg-[var(--color-primary-subtle)] hover:border-[var(--color-primary)] text-[var(--color-primary)] transition-colors"
                title={`עבור למועמד הבא (${(linkObj.candidateIndex ?? 0) + 1}/${linkObj.candidates.length})`}
              >
                <Layers className="w-3 h-3" />
                <span>מועמד {(linkObj.candidateIndex ?? 0) + 1}/{linkObj.candidates.length}</span>
              </button>
            )}

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
        {(() => {
          if (!rawLineText || rawLineText.length <= 100) {
            return (
              <div
                className="text-sm md:text-base font-sans leading-relaxed text-[var(--color-on-surface)] [&_b]:font-bold [&_b]:text-[var(--color-primary)] [&_b]:bg-[var(--color-primary-subtle)] [&_b]:px-1.5 [&_b]:py-0.5 [&_b]:rounded-md"
                dangerouslySetInnerHTML={{ __html: formattedHtml }}
              />
            );
          }
          return <CollapsibleCommentary html={formattedHtml} />;
        })()}
      </div>

    );
  };

  // Render Section Heading Banner if this group is the first group for its segment on the current page
  const renderSegmentHeaderIfNeeded = (groupCommLineIdx1: number, gIdx: number) => {
    const segIndex = commentarySegments.findIndex(
      s => groupCommLineIdx1 >= s.startLine && groupCommLineIdx1 <= s.endLine
    );
    if (segIndex === -1) return null;

    const seg = commentarySegments[segIndex];

    const isFirstGroupForSegOnPage = groupedCommentary.findIndex(
      g => g.commIndices[0] >= seg.startLine && g.commIndices[0] <= seg.endLine
    ) === gIdx;

    if (!isFirstGroupForSegOnPage) return null;

    const headerId = seg.headerLineIndex > 0 ? `header-${seg.headerLineIndex}` : `header-start-${seg.startLine}`;
    const isHighlighted = highlightedHeaderId === headerId;

    return (
      <div
        id={headerId}
        key={`seg-banner-${seg.headerLineIndex || seg.startLine}`}
        className={`my-5 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[var(--color-primary-subtle)] to-transparent border-r-4 border-[var(--color-primary)] shadow-xs transition-all flex flex-wrap items-center justify-between gap-3 ${
          isHighlighted
            ? 'ring-4 ring-amber-400 dark:ring-amber-500 animate-pulse scale-[1.01] bg-amber-500/20'
            : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xs">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-[var(--color-on-surface)] font-serif">
              {seg.headerTitle}
            </h3>
            <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5 font-medium">
              שורות {seg.startLine} עד {seg.endLine}
            </p>
          </div>
        </div>
        {seg.headerLineIndex > 0 && (
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-outline)] text-[var(--color-primary)] shadow-2xs">
            כותרת בשורה {seg.headerLineIndex}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 text-right" dir="rtl">
      {/* Main Unified List */}
      <div className="space-y-4 relative" ref={containerRef}>
        <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }}>
          {svgLines.map(line => {
            const lineIdNum = parseInt(line.id.replace('line-', ''), 10);
            const isHovered = hoveredCommLineIdx === lineIdNum;
            const isAnyHovered = hoveredCommLineIdx !== null;
            
            const offset = Math.abs(line.x1 - line.x2) / 2;
            const pathData = `M ${line.x1} ${line.y1} C ${line.x1 - offset} ${line.y1}, ${line.x2 + offset} ${line.y2}, ${line.x2} ${line.y2}`;
            
            let opacity = "0.55";
            let strokeWidth = "2.5";
            if (isAnyHovered) {
              opacity = isHovered ? "0.95" : "0.15";
              strokeWidth = isHovered ? "3.5" : "1.5";
            }

            return (
              <g key={line.id}>
                {isHovered && (
                  <path
                    d={pathData}
                    stroke={line.color || "var(--color-primary)"}
                    strokeWidth="7"
                    fill="none"
                    opacity="0.2"
                    className="transition-all duration-300 animate-pulse"
                  />
                )}
                <path 
                  d={pathData} 
                  stroke={line.color || "var(--color-primary)"}
                  strokeWidth={strokeWidth} 
                  fill="none"
                  opacity={opacity}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>
        {groupedCommentary.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--color-on-surface-variant)] bg-[var(--color-surface)] rounded-2xl border border-dashed border-[var(--color-outline)] font-medium">
            לא נמצאו שורות פירוש המתאימות לסינון המבוקש
          </div>
        ) : (
          groupedCommentary.map((group, gIdx) => {
            const firstLinkObj = group.links[0];
            const firstCommIdx = group.commIndices[0];

            return (
              <React.Fragment key={`comm-group-wrap-${group.targetKey}-${gIdx}`}>
                {renderSegmentHeaderIfNeeded(firstCommIdx, gIdx)}
                <div
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
                    {(() => {
                      const targetType = firstLinkObj?.secondaryTarget || 'primary';
                      const colors = getTargetColors(targetType);
                      return (
                    <>
                    <div className={`flex flex-wrap items-center justify-between gap-1 text-xs font-bold ${colors.text}`}>
                      {firstLinkObj ? (
                        <>
                          <span className="font-bold">
                            מקור: {firstLinkObj.secondaryTarget ? (firstLinkObj.secondaryTarget === 'rashi' ? 'רש"י' : 'תוספות') : config.targetBookName} (שורה {firstLinkObj.secondaryTarget ? firstLinkObj.secondary_line_index : firstLinkObj.line_index_2})
                          </span>
                          <span className={`text-[11px] ${colors.bgTitle} px-2 py-0.5 rounded-md ${colors.text} font-bold max-w-[180px] truncate`} title={firstLinkObj.secondaryRef || firstLinkObj.heRef_2 || firstLinkObj.path_2}>
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
                        links={group.links}
                        targetType={targetType}
                        onHoverMatch={setHoveredCommLineIdx}
                      />
                    ) : (
                      <div className="p-5 rounded-xl border border-dashed border-[var(--color-outline)] text-center text-xs text-[var(--color-on-surface-variant)]">
                        אין מקור מקושר. לחץ על כפתור העריכה בכרטיס הפירוש כדי לקשר.
                      </div>
                    )}
                    </>
                    );
                    })()}
                  </div>
                </div>
              </React.Fragment>
            );
          })
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
                  className="p-1.5 text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100 hover:bg-rose-200 dark:hover:bg-rose-900 rounded-xl transition-colors inline-flex items-center justify-center"
                  title="הצג שורות לא מקושרות"
                >
                  <Eye className="w-3.5 h-3.5" />
                  
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
          commentaryLines={commentaryLines}
          rashiLines={rashiLines}
          tosafotLines={tosafotLines}
          targetBookName={config.targetBookName}
          isShas={config.sourceCategory === 'shas'}
          onSave={handleSaveLink}
          onClose={() => setEditingCommLineIdx(null)}
        />
      )}

      {/* Retractable Navigation Drawer Sidebar */}
      {isNavDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-start animate-fade-in" dir="rtl">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseNavDrawer}
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-80 sm:w-96 max-w-[85vw] h-full bg-[var(--color-surface)] border-l border-[var(--color-outline)] shadow-2xl flex flex-col font-sans transition-all">
            {/* Drawer Header */}
            
            {/* Drawer Header */}
            <div className="flex flex-col bg-[var(--color-surface-container-high)]">
              <div className="p-4 border-b border-[var(--color-outline)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xs">
                    <ListTree className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[var(--color-on-surface)]">
                      סרגל ניווט וחיפוש
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onCloseNavDrawer}
                  className="p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-lg transition-colors"
                  title="סגור סרגל ניווט"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex items-center border-b border-[var(--color-outline)]">
                <button
                  onClick={() => setDrawerTab('nav')}
                  className={`flex-1 py-2 text-xs font-bold transition-colors ${
                    drawerTab === 'nav'
                      ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)]'
                  }`}
                >
                  ניווט
                </button>
                <button
                  onClick={() => setDrawerTab('search')}
                  className={`flex-1 py-2 text-xs font-bold transition-colors ${
                    drawerTab === 'search'
                      ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)]'
                  }`}
                >
                  חיפוש
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              {drawerTab === 'search' ? (
                <div className="p-4 space-y-4">
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={e => setSourceSearchQuery(e.target.value)}
                    placeholder="חיפוש בכל הפרויקט..."
                    className="w-full pl-3 pr-4 py-2 text-sm bg-[var(--color-surface-container-low)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-sans"
                  />
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    החיפוש מסנן את הרשימה הראשית לפי שורות פירוש או מקור.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Heading Search */}
                  {commentarySegments.length > 3 && (
                    <div className="p-3 border-b border-[var(--color-outline)] bg-[var(--color-surface-container-low)] shrink-0">
                      <div className="relative">
                        <input
                          type="text"
                          value={drawerSearchQuery}
                          onChange={(e) => setDrawerSearchQuery(e.target.value)}
                          placeholder="סינון/חיפוש בכותרות..."
                          className="w-full pl-3 pr-8 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-lg text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-sans"
                        />
                        <Search className="w-3.5 h-3.5 text-[var(--color-on-surface-variant)] absolute right-2.5 top-2.5" />
                      </div>
                    </div>
                  )}

                  {/* List of extracted Headings */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredDrawerSegments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-low)] rounded-xl border border-dashed border-[var(--color-outline)] font-medium">
                        לא נמצאו כותרות המתאימות לחיפוש
                      </div>
                    ) : (
                      filteredDrawerSegments.map((seg, sIdx) => {
                        const segLinkCount = links.filter(
                          l => l.line_index_1 >= seg.startLine && l.line_index_1 <= seg.endLine
                        ).length;

                        return (
                          <button
                            key={`drawer-seg-${sIdx}`}
                            onClick={() => handleSelectHeading(seg)}
                            className="w-full text-right p-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-primary-subtle)] hover:border-[var(--color-primary)] transition-all group flex flex-col gap-1.5 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Bookmark className="w-4 h-4 text-[var(--color-primary)] shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-xs sm:text-sm text-[var(--color-on-surface)] truncate font-serif">
                                  {seg.headerTitle}
                                </span>
                              </div>
                              {seg.headerLineIndex > 0 && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-outline)] text-[var(--color-on-surface-variant)] shrink-0">
                                  שורה {seg.headerLineIndex}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[var(--color-on-surface-variant)] pt-1.5 border-t border-[var(--color-outline-variant)]/60">
                              <span>שורות {seg.startLine} עד {seg.endLine}</span>
                              <span className="font-bold text-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-0.5 rounded-md border border-[var(--color-outline-variant)]">
                                {segLinkCount} קישורים
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="p-3 border-t border-[var(--color-outline)] bg-[var(--color-surface-container-high)] text-center text-xs text-[var(--color-on-surface-variant)] font-medium shrink-0">
                    לחיצה על כותרת תגלול אוטומטית לקטע המבוקש בדף
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Small Panes for Drag and Drop Re-linking */}
      {draggedCommLineIdx !== null && (
        <div 
          className="fixed left-6 top-24 bottom-24 w-80 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-2xl shadow-2xl p-4 flex flex-col gap-3 z-[100] animate-fade-in text-right select-none"
          dir="rtl"
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] pb-3">
            <h4 className="text-sm font-bold text-[var(--color-primary)] font-serif">
              שורות מקור לקישור מהיר
            </h4>
            <span className="text-[10px] bg-[var(--color-secondary-subtle)] px-2 py-0.5 rounded-full text-[var(--color-on-secondary-container)] font-mono font-bold">
              שורה {draggedCommLineIdx}
            </span>
          </div>

          <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed font-medium">
            גרור את כרטיס הפירוש ושחרר אותו על אחת השורות למטה כדי לעדכן את הקישור במיידי:
          </p>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {floatingSourceLines.map((srcLine) => {
              const isOver = dragOverSourceIdx === srcLine.index && dragOverSourceType === srcLine.targetType;
              const isCurrent = srcLine.isCurrent;
              
              let cardBg = "bg-[var(--color-surface-container-low)] border-[var(--color-outline-variant)]";
              if (isCurrent) {
                cardBg = "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]";
              }
              if (isOver) {
                cardBg = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 scale-[1.02] shadow-md ring-2 ring-emerald-500";
              }

              return (
                <div
                  key={`${srcLine.targetType}-${srcLine.index}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverSourceIdx !== srcLine.index || dragOverSourceType !== srcLine.targetType) {
                      setDragOverSourceIdx(srcLine.index);
                      setDragOverSourceType(srcLine.targetType);
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverSourceIdx(null);
                    setDragOverSourceType(null);
                  }}
                  onDrop={() => handleDropOnSourceLine(srcLine.index, srcLine.targetType)}
                  className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-1.5 ${cardBg}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--color-on-surface)] font-mono">
                      שורה {srcLine.index}
                    </span>
                    <span className="text-[10px] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] px-2 py-0.5 rounded font-bold font-serif">
                      {srcLine.targetLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed line-clamp-2 font-sans font-medium" title={srcLine.text}>
                    {srcLine.text || '(שורה ריקה)'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
