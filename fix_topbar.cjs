const fs = require('fs');
let code = fs.readFileSync('src/components/TopToolbar.tsx', 'utf8');
code = code.replace(
  "import { Save, FolderOpen, Download, ArrowLeftRight, RotateCcw, ListTree, Filter } from 'lucide-react';",
  "import { Save, FolderOpen, Download, ArrowLeftRight, RotateCcw, ListTree, Filter, Menu } from 'lucide-react';"
);

code = code.replace(
  /<header className="sticky top-0 z-40 w-full bg-\[var\(--color-surface-container-high\)\] text-\[var\(--color-on-surface\)\] shadow-xs border-b border-\[var\(--color-outline\)\]" dir="rtl">[\s\S]*<\/header>/,
  `<header className="sticky top-0 z-40 w-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)] shadow-xs border-b border-[var(--color-outline)]" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        {/* Rightmost: Hamburger menu */}
        <button
          onClick={onToggleNavDrawer}
          className={\`inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] transition-colors shrink-0 \${
            mode === 'setup'
              ? 'opacity-40 pointer-events-none text-[var(--color-on-surface-variant)]'
              : isNavDrawerOpen
                ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                : 'text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)]'
          }\`}
          title="תפריט ניווט"
          aria-label="תפריט המבורגר"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Books Tag */}
        <div className="flex items-center gap-2 px-1 py-1.5 shrink-0">
          <span className="text-xs font-bold text-[var(--color-primary)] max-w-[180px] truncate" title={commentaryName}>
            {commentaryName}
          </span>
          <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--color-on-surface-variant)] shrink-0 mx-1" />
          <span className="text-xs font-bold text-[var(--color-on-surface)] max-w-[180px] truncate" title={sourceName}>
            {sourceName}
          </span>
          {session && (
            <span className="text-[11px] bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] border border-[var(--color-outline-variant)] mr-2">
              {session.links.length} קישורים
            </span>
          )}
        </div>
        
        {/* Actions Group (Leftmost) */}
        <div className="flex items-center justify-end flex-1 gap-1">
          <button
            onClick={handleExportZip}
            disabled={!session}
            className="inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="ייצא קובץ ZIP"
            aria-label="הורדה"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={onOpenProjects}
            className="inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)] transition-colors"
            title="פתח פרויקט שמור מהמטמון"
            aria-label="פתיחת פרויקטים"
          >
            <FolderOpen className="w-5 h-5" />
          </button>

          <button
            onClick={onSaveSession}
            disabled={!session}
            className="inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="שמור מצב נוכחי"
            aria-label="שמירה"
          >
            <Save className="w-5 h-5" />
          </button>

          <div className="w-px h-5 bg-[var(--color-outline)] mx-1" />

          {mode === 'edit' && onSortModeChange && (
            <div className="relative inline-block">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)] transition-colors"
                title="מיון תוצאות"
                aria-label="סינון ומיון"
              >
                <Filter className="w-5 h-5" />
              </button>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                  <div className="absolute top-[calc(100%+6px)] left-0 w-48 bg-[var(--color-surface-container-highest)] rounded-[var(--radius-md)] shadow-lg border border-[var(--color-outline)] p-2 z-50 flex flex-col gap-1">
                    <button
                      className={\`text-right px-3 py-2 text-xs font-semibold rounded-[var(--radius-sm)] \${sortMode === 'book_order' ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' : 'text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)]'}\`}
                      onClick={() => { onSortModeChange('book_order'); setIsFilterOpen(false); }}
                    >
                      מיון לפי סדר הספר
                    </button>
                    <button
                      className={\`text-right px-3 py-2 text-xs font-semibold rounded-[var(--radius-sm)] \${sortMode === 'score_asc' ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' : 'text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)]'}\`}
                      onClick={() => { onSortModeChange('score_asc'); setIsFilterOpen(false); }}
                    >
                      מיון לפי ניקוד (סדר עולה)
                    </button>
                    <button
                      className={\`text-right px-3 py-2 text-xs font-semibold rounded-[var(--radius-sm)] \${sortMode === 'score_desc' ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' : 'text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)]'}\`}
                      onClick={() => { onSortModeChange('score_desc'); setIsFilterOpen(false); }}
                    >
                      מיון לפי ניקוד (סדר יורד)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'edit' && (
            <button
              onClick={onReturnToSetup}
              className="inline-flex items-center justify-center p-2 rounded-[var(--radius-sm)] text-[var(--color-on-surface)] hover:bg-[var(--color-secondary-subtle)] transition-colors"
              title="חזור למסך בחירת ספרים"
              aria-label="רענון"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>`
);

fs.writeFileSync('src/components/TopToolbar.tsx', code);
