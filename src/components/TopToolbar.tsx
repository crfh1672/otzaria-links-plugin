import React from 'react';
import { Save, FolderOpen, Download, ArrowLeftRight, Code, RotateCcw, ListTree } from 'lucide-react';
import JSZip from 'jszip';
import { SessionState } from '../types';
import { formatLineWithDH, parseDocumentSegments } from '../utils/parserAlgorithm';
import { notifySuccess, notifyError } from '../utils/otzariaBridge';

interface TopToolbarProps {
  session: SessionState | null;
  mode: 'setup' | 'edit';
  onSaveSession: () => void;
  onOpenProjects: () => void;
  onOpenHtmlModal: () => void;
  onReturnToSetup: () => void;
  isNavDrawerOpen?: boolean;
  onToggleNavDrawer?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  session,
  mode,
  onSaveSession,
  onOpenProjects,
  onOpenHtmlModal,
  onReturnToSetup,
  isNavDrawerOpen,
  onToggleNavDrawer,
}) => {
  const commentaryName = session?.commentaryTitle || 'ספר פירוש';
  const sourceName = session?.config?.targetBookName || 'ספר מקור';

  const handleExportZip = async () => {
    if (!session) {
      notifyError('אין פרויקט פעיל לייצוא');
      return;
    }

    try {
      const zip = new JSZip();

      // 1. Generate _links.json
      const exportedLinks: any[] = [];
      session.links.forEach(link => {
        exportedLinks.push({
          line_index_1: link.line_index_1,
          line_index_2: link.line_index_2,
          heRef_2: link.heRef_2,
          path_2: link.path_2,
          connection_type: link.connection_type
        });
      });

      const linksJsonContent = JSON.stringify(exportedLinks, null, 2);
      const cleanFileName = session.commentaryTitle.replace(/[/\\?%*:|"<>]/g, '_');
      zip.file(`${cleanFileName}_links.json`, linksJsonContent);

      // 2. Generate _links.csv without dhText/confidence/status
      const csvHeaders = ['line_index_1', 'line_index_2', 'heRef_2', 'path_2', 'connection_type'];
      const escapeCsv = (val: any) => {
        if (val === undefined || val === null) return '""';
        const str = String(val);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
      };

      const csvRows = session.links.map(link => [
        escapeCsv(link.line_index_1),
        escapeCsv(link.line_index_2),
        escapeCsv(link.heRef_2),
        escapeCsv(link.path_2),
        escapeCsv(link.connection_type || 'commentary')
      ].join(','));

      const csvContent = '\uFEFF' + [csvHeaders.join(','), ...csvRows].join('\r\n');
      zip.file(`${cleanFileName}_links.csv`, csvContent);

      // 3. Generate analysis CSV with DH, source word comparisons and score details
      const analysisHeaders = [
        'line_index_1',
        'commentary_line',
        'dh_text',
        'line_index_2',
        'source_line',
        'source_words',
        'confidence',
        'status',
        'candidate_scores',
        'analysis_notes'
      ];

      const normalizeForCsv = (val: any) => escapeCsv(val === undefined || val === null ? '' : val);
      const analysisRows = session.links.map(link => {
        const commentaryLine = session.commentaryLines[link.line_index_1 - 1] || '';
        const sourceLine = session.sourceLines[link.line_index_2 - 1] || '';
        const dhText = link.dhText || '';
        const sourceWords = sourceLine.trim().split(/\s+/).filter(Boolean).join(' ');
        const candidateScores = link.candidates?.map(c => `${c.lineNum}:${c.score.toFixed(2)}`).join('; ') || '';
        const analysisNotes = `match_confidence=${link.confidence ?? 0}; candidates=${candidateScores || 'none'}`;

        return [
          normalizeForCsv(link.line_index_1),
          normalizeForCsv(commentaryLine),
          normalizeForCsv(dhText),
          normalizeForCsv(link.line_index_2),
          normalizeForCsv(sourceLine),
          normalizeForCsv(sourceWords),
          normalizeForCsv(link.confidence ?? ''),
          normalizeForCsv(link.status ?? ''),
          normalizeForCsv(candidateScores),
          normalizeForCsv(analysisNotes)
        ].join(',');
      });

      const analysisContent = '\uFEFF' + [analysisHeaders.join(','), ...analysisRows].join('\r\n');
      zip.file(`${cleanFileName}_analysis.csv`, analysisContent);

      // 3. Generate updated commentary .txt file with <b>...</b> tags
      const updatedLines = session.commentaryLines.map((line, idx) => {
        const lineIdx1 = idx + 1; // 1-based
        const highlight = session.dhHighlights?.[lineIdx1];
        if (highlight && highlight.wordCount > 0) {
          return formatLineWithDH(line, highlight);
        }
        return line;
      });

      // Join strictly with physical newlines (\n) - NO <br> tags!
      const txtContent = updatedLines.join('\n');
      zip.file(`${cleanFileName}.txt`, txtContent);

      // Generate ZIP blob and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanFileName}_package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifySuccess('קובץ ZIP (כולל TXT, JSON ו-CSV) ייוצא בהצלחה!');
    } catch (e) {
      console.error(e);
      notifyError('אירעה שגיאה ביצירת קובץ ה-ZIP');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] shadow-xs border-b border-[var(--color-outline)]">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Right side: Commentary and Source Active Book Titles */}
        <div className="flex items-center gap-2 bg-[var(--color-surface)] px-3 py-1.5 rounded-xl border border-[var(--color-outline)] shadow-2xs">
          <span className="text-xs font-bold text-[var(--color-primary)] max-w-[180px] truncate" title={commentaryName}>
            {commentaryName}
          </span>
          <ArrowLeftRight className="w-3.5 h-3.5 text-current shrink-0 mx-1" />
          <span className="text-xs font-bold text-[var(--color-on-surface)] max-w-[180px] truncate" title={sourceName}>
            {sourceName}
          </span>
          {session && (
            <span className="text-[11px] bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold px-2 py-0.5 rounded-full border border-[var(--color-outline-variant)] mr-1">
              {session.links.length} קישורים
            </span>
          )}
        </div>

        {/* Left side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {mode === 'edit' && onToggleNavDrawer && (
            <button
              onClick={onToggleNavDrawer}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-xs border ${
                isNavDrawerOpen
                  ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-on-surface)] hover:bg-[var(--color-outline-variant)] border-[var(--color-outline)]'
              }`}
              title="סרגל ניווט בכותרות ופרקים"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>ניווט בכותרות</span>
              {session && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-100 font-mono mr-0.5">
                  {parseDocumentSegments(session.commentaryLines.join('\n')).segments.length}
                </span>
              )}
            </button>
          )}

          {mode === 'edit' && (
            <button
              onClick={onReturnToSetup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--color-surface)] text-[var(--color-on-surface)] hover:bg-[var(--color-outline-variant)] rounded-lg transition-colors border border-[var(--color-outline)]"
              title="חזור למסך בחירת ספרים"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>שינוי ספרים</span>
            </button>
          )}

          <button
            onClick={onSaveSession}
            disabled={!session}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all shadow-xs"
            title="שמור מצב נוכחי למטמון המקומי"
          >
            <Save className="w-3.5 h-3.5" />
            <span>שמירה</span>
          </button>

          <button
            onClick={onOpenProjects}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--color-surface)] text-[var(--color-on-surface)] hover:bg-[var(--color-outline-variant)] rounded-lg transition-colors border border-[var(--color-outline)]"
            title="פתח פרויקט שמור מהמטמון"
          >
            <FolderOpen className="w-3.5 h-3.5 text-current" />
            <span>פתיחה</span>
          </button>

          <button
            onClick={handleExportZip}
            disabled={!session}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-700 dark:bg-emerald-600 text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all shadow-xs"
            title="ייצא קובץ ZIP עם _links.json וקובץ TXT מעודכן"
          >
            <Download className="w-3.5 h-3.5" />
            <span>יצוא ZIP</span>
          </button>

          <button
            onClick={onOpenHtmlModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--color-secondary-subtle)] text-[var(--color-on-surface)] hover:bg-[var(--color-outline-variant)] rounded-lg transition-colors border border-[var(--color-outline)]"
            title="קימפול ל-HTML בודד והורדת התוסף לגיטהאב"
          >
            <Code className="w-3.5 h-3.5 text-current" />
            <span>קימפול HTML בודד</span>
          </button>
        </div>
      </div>
    </header>
  );
};
