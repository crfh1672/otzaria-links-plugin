import fs from 'fs';

let content = fs.readFileSync('src/components/TopToolbar.tsx', 'utf-8');

// Add sort mode to props
content = content.replace(
  "interface TopToolbarProps {",
  "interface TopToolbarProps {\n  sortMode?: 'book_order' | 'score_asc' | 'score_desc';\n  onSortModeChange?: (mode: 'book_order' | 'score_asc' | 'score_desc') => void;"
);

// Destructure new props
content = content.replace(
  "  onToggleNavDrawer\n}) => {",
  "  onToggleNavDrawer,\n  sortMode,\n  onSortModeChange\n}) => {"
);

// We need to move the Nav Drawer button to the right side
const rightSideMatch = /<div className="flex items-center gap-2 bg-\[var\(--color-surface\)\] px-3 py-1.5 rounded-xl border border-\[var\(--color-outline\)\] shadow-2xs">[\s\S]*?<\/div>/;
const navButtonMatch = /{mode === 'edit' && onToggleNavDrawer && \([\s\S]*?<\/button>\s*\)}/;

const navButton = content.match(navButtonMatch)?.[0];
const rightSide = content.match(rightSideMatch)?.[0];

if (navButton && rightSide) {
  content = content.replace(navButton, ""); // Remove from left side
  // Add to right side
  content = content.replace(
    rightSide,
    `
      <div className="flex items-center gap-2">
        ${navButton.replace("<span>ניווט בכותרות</span>", "<span>ניווט וחיפוש</span>").replace("סרגל ניווט בכותרות ופרקים", "סרגל ניווט וחיפוש")}
        ${rightSide}
      </div>
    `
  );
}

// Remove HTML button
const htmlButtonMatch = /<button\s+onClick={onOpenHtmlModal}[\s\S]*?<\/button>/;
const htmlButton = content.match(htmlButtonMatch)?.[0];
if (htmlButton) {
  content = content.replace(htmlButton, "");
}

// Add Sort dropdown to left side, next to export zip
const exportZipMatch = /<button\s+onClick={handleExportZip}[\s\S]*?<\/button>/;
const exportZip = content.match(exportZipMatch)?.[0];

if (exportZip) {
  const sortDropdown = `
          {mode === 'edit' && onSortModeChange && (
            <select
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as any)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--color-surface)] text-[var(--color-on-surface)] hover:bg-[var(--color-outline-variant)] rounded-lg transition-colors border border-[var(--color-outline)] cursor-pointer outline-none"
              title="מיון תוצאות"
            >
              <option value="book_order">מיון לפי סדר הספר</option>
              <option value="score_asc">מיון לפי ניקוד (סדר עולה)</option>
              <option value="score_desc">מיון לפי ניקוד (סדר יורד)</option>
            </select>
          )}
  `;
  content = content.replace(exportZip, sortDropdown + "\n" + exportZip);
}

fs.writeFileSync('src/components/TopToolbar.tsx', content);
