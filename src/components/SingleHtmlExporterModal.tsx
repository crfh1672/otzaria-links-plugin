import React, { useState } from 'react';
import { X, Code, Download, Github, CheckCircle2, FileCode } from 'lucide-react';
import JSZip from 'jszip';
import { notifySuccess, notifyError } from '../utils/otzariaBridge';

interface SingleHtmlExporterModalProps {
  onClose: () => void;
}

export const SingleHtmlExporterModal: React.FC<SingleHtmlExporterModalProps> = ({ onClose }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadOtzpluginZip = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();

      // Read manifest.json format
      const manifest = {
        schemaVersion: 1,
        id: "com.otzaria.links-generator",
        name: "מחולל קישורים",
        version: "1.0.0",
        description: "תוסף אוצריא לייצור קישורים (links.json) והדגשת דיבור המתחיל (ד\"ה)",
        author: "מפתח אוצריא",
        homepage: "https://github.com/Otzaria/otzaria",
        entrypoint: "index.html",
        minAppVersion: "0.9.93",
        sdkVersion: "1.x",
        stability: "stable",
        permissions: [
          "app.info.read",
          "library.books.read",
          "library.content.read",
          "plugin.storage.read",
          "plugin.storage.write",
          "ui.feedback",
          "events.subscribe:theme.changed"
        ],
        network: {
          enabled: false,
          allowlist: []
        },
        contributes: {
          toolTab: {
            title: "מחולל קישורים",
            order: 150,
            allowOrderBeforeBuiltIns: false,
            defaultPinned: true,
            iconName: "link_24_regular"
          }
        }
      };

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      // Get current index.html DOM content or generate bundled single HTML
      const htmlContent = document.documentElement.outerHTML;
      zip.file("index.html", htmlContent);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "com.otzaria.links-generator.otzplugin";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifySuccess('קובץ החבילה otzplugin. ייוצא בהצלחה!');
    } catch (e) {
      console.error(e);
      notifyError('שגיאה ביצירת קובץ ה-otzplugin');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSingleHtml = () => {
    try {
      const docHtml = `<!DOCTYPE html>
<html lang="he" dir="rtl">
${document.documentElement.innerHTML}
</html>`;

      const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "otzaria-links-plugin.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifySuccess('קובץ HTML בודד ייוצא בהצלחה!');
    } catch (e) {
      console.error(e);
      notifyError('שגיאה בהורדת קובץ HTML בודד');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <Code className="w-4 h-4" />
            <span>קימפול וייצוא התוסף עבור אוצריא ו-GitHub</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3.5 rounded-lg space-y-1.5">
            <h4 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Github className="w-4 h-4" />
              <span>תאימות מלאה להוראות SDK תוספי אוצריא</span>
            </h4>
            <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
              התוסף מוכן לייצוא כחבילת <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">.otzplugin</code> עבור התקנה ישרות באוצריא, או כקובץ HTML בודד מקומפל המתאים ל-GitHub Releases ו-CI Actions.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-500" />
                  <span>קובץ .otzplugin עבור התקנה באוצריא</span>
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  כולל manifest.json מעודכן, הרשאות SDK v1.x וקובץ הכניסה
                </p>
              </div>
              <button
                onClick={handleDownloadOtzpluginZip}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-xs shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>הורד .otzplugin</span>
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-emerald-500" />
                  <span>קובץ HTML בודד (Single HTML Bundle)</span>
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  דף אינטרנט עצמאי שרץ בכל דפדפן או כתוסף ב-WebView
                </p>
              </div>
              <button
                onClick={handleDownloadSingleHtml}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-xs shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>הורד HTML בודד</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-left">
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
