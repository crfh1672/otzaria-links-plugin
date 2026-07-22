import React from 'react';
import { Save, FolderOpen, Download, ArrowLeftRight, Code, RotateCcw } from 'lucide-react';
import JSZip from 'jszip';
import { SessionState } from '../types';
import { formatLineWithDH } from '../utils/parserAlgorithm';
import { notifySuccess, notifyError } from '../utils/otzariaBridge';

interface TopToolbarProps {
  session: SessionState | null;
  mode: 'setup' | 'edit';
  onSaveSession: () => void;
  onOpenProjects: () => void;
  onOpenHtmlModal: () => void;
  onReturnToSetup: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  session,
  mode,
  onSaveSession,
  onOpenProjects,
  onOpenHtmlModal,
  onReturnToSetup,
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
      const linksJsonContent = JSON.stringify(session.links, null, 2);
      const cleanFileName = session.commentaryTitle.replace(/[/\\?%*:|"<>]/g, '_');
      zip.file(`${cleanFileName}_links.json`, linksJsonContent);

      // 2. Generate updated commentary .txt file with <b>...</b> tags
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

      notifySuccess('קובץ ZIP ייוצא בהצלחה!');
    } catch (e) {
      console.error(e);
      notifyError('אירעה שגיאה ביצירת קובץ ה-ZIP');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Right side: Commentary and Source Active Book Titles */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
          <span className="text-sm font-semibold text-amber-300 max-w-[200px] truncate" title={commentaryName}>
            {commentaryName}
          </span>
          <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0 mx-1" />
          <span className="text-sm font-semibold text-emerald-300 max-w-[200px] truncate" title={sourceName}>
            {sourceName}
          </span>
          {session && (
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/30 mr-1">
              {session.links.length} קישורים
            </span>
          )}
        </div>

        {/* Left side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {mode === 'edit' && (
            <button
              onClick={onReturnToSetup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white rounded-md transition-colors border border-slate-700"
              title="חזור למסך בחירת ספרים"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>שינוי ספרים</span>
            </button>
          )}

          <button
            onClick={onSaveSession}
            disabled={!session}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-sm"
            title="שמור מצב נוכחי למטמון המקומי"
          >
            <Save className="w-3.5 h-3.5" />
            <span>שמירה</span>
          </button>

          <button
            onClick={onOpenProjects}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white rounded-md transition-colors border border-slate-700"
            title="פתח פרויקט שמור מהמטמון"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>פתיחה</span>
          </button>

          <button
            onClick={handleExportZip}
            disabled={!session}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-sm"
            title="ייצא קובץ ZIP עם _links.json וקובץ TXT מעודכן"
          >
            <Download className="w-3.5 h-3.5" />
            <span>יצוא ZIP</span>
          </button>

          <button
            onClick={onOpenHtmlModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600/90 text-amber-50 hover:bg-amber-500 rounded-md transition-colors shadow-sm border border-amber-500/30"
            title="קימפול ל-HTML בודד והורדת התוסף לגיטהאב"
          >
            <Code className="w-3.5 h-3.5" />
            <span>קימפול HTML בודד</span>
          </button>
        </div>
      </div>
    </header>
  );
};
