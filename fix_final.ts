import fs from 'fs';

// --- 1. App.tsx ---
let appTsx = fs.readFileSync('src/App.tsx', 'utf-8');
// Completely remove showHtmlExporterModal
appTsx = appTsx.replace(/const \[showHtmlExporterModal, setShowHtmlExporterModal\] = useState\(false\);/, "");
appTsx = appTsx.replace(/\{showHtmlExporterModal && \([\s\S]*?<\/SingleHtmlExporterModal>\s*\)\}/, "");
// Remove import if still there
appTsx = appTsx.replace(/import \{ SingleHtmlExporterModal \}.*?;/, "");
fs.writeFileSync('src/App.tsx', appTsx);

// --- 2. TopToolbar.tsx ---
let topToolbar = fs.readFileSync('src/components/TopToolbar.tsx', 'utf-8');
// ensure onSortModeChange is in props interface
if (!topToolbar.includes("onSortModeChange?:")) {
  topToolbar = topToolbar.replace(
    "interface TopToolbarProps {",
    "interface TopToolbarProps {\n  sortMode?: 'book_order' | 'score_asc' | 'score_desc';\n  onSortModeChange?: (mode: 'book_order' | 'score_asc' | 'score_desc') => void;"
  );
}
// remove onOpenHtmlModal from destructured props
topToolbar = topToolbar.replace(/,\s*onOpenHtmlModal/g, "");
topToolbar = topToolbar.replace(/onOpenHtmlModal,/g, "");
topToolbar = topToolbar.replace(/onOpenHtmlModal/g, "");
// add sortMode and onSortModeChange to destructured props if not there
if (!topToolbar.includes("sortMode,") || !topToolbar.includes("onSortModeChange")) {
  topToolbar = topToolbar.replace(
    "  onToggleNavDrawer\n}) => {",
    "  onToggleNavDrawer,\n  sortMode,\n  onSortModeChange\n}) => {"
  );
  // It might be like `isNavDrawerOpen,\n  onToggleNavDrawer`
  topToolbar = topToolbar.replace(
    "  onToggleNavDrawer,",
    "  onToggleNavDrawer,\n  sortMode,\n  onSortModeChange,"
  );
}
fs.writeFileSync('src/components/TopToolbar.tsx', topToolbar);


// --- 3. EditMode.tsx ---
let editMode = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');
// Fix imports
if (!editMode.includes('useRef')) {
  editMode = editMode.replace("import React, { useState } from 'react';", "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';");
} else {
  // If they are missing, just ensure they are all there
  editMode = editMode.replace(/import React, \{.*?\} from 'react';/, "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';");
}

// Fix tagName any type error
editMode = editMode.replace("if ((e.target as any).tagName !== 'MARK') {", "if (e.target && (e.target as HTMLElement).tagName !== 'MARK') {");
editMode = editMode.replace("(e.target as Element)", "(e.target as HTMLElement)");

// Remove remaining pagination usages
editMode = editMode.replace(/const totalPages = Math\.ceil\(filteredCommentaryIndices\.length \/ pageSize\);/, "");
editMode = editMode.replace(/disabled=\{currentPage <= 1\}/g, "");
editMode = editMode.replace(/disabled=\{currentPage >= totalPages\}/g, "");
editMode = editMode.replace(/onClick=\{\(\) => setCurrentPage\(\(p\) => Math.max\(1, p - 1\)\)\}/g, "");
editMode = editMode.replace(/onClick=\{\(\) => setCurrentPage\(\(p\) => Math.min\(totalPages, p \+ 1\)\)\}/g, "");
editMode = editMode.replace(/עמוד \{currentPage\} מתוך \{totalPages\}/g, "");

// We still have some `filteredCommentaryIndices` usages around line 414.
editMode = editMode.replace(/filteredCommentaryIndices/g, "sortedCommentaryIndices");
// and `pageSize` around line 420
editMode = editMode.replace(/pageSize/g, "40");
// and `setCurrentPage(1)` around line 421
editMode = editMode.replace(/setCurrentPage\(1\)/g, "");

// Type '() => React.JSX.Element' is not assignable to type 'ReactNode'
// this happens because of `renderSegmentHeaderIfNeeded(firstCommIdx, gIdx)`
// we need to call it if it's a function that returns JSX
editMode = editMode.replace(/\{renderSegmentHeaderIfNeeded\(firstCommIdx, gIdx\)\}/g, "{renderSegmentHeaderIfNeeded(firstCommIdx, gIdx)}"); // actually, it returns a JSX element, wait, maybe it was returning a function?
// renderSegmentHeaderIfNeeded is defined as `const renderSegmentHeaderIfNeeded = (groupCommLineIdx1: number, gIdx: number) => {` and returns JSX or null.

fs.writeFileSync('src/components/EditMode.tsx', editMode);
