import fs from 'fs';

// 1. Fix TopToolbar.tsx props
let topToolbar = fs.readFileSync('src/components/TopToolbar.tsx', 'utf-8');
topToolbar = topToolbar.replace(/onOpenHtmlModal[\s\S]*?=> void;/, "");
fs.writeFileSync('src/components/TopToolbar.tsx', topToolbar);

// 2. Fix App.tsx - it might have some issues left
let appTsx = fs.readFileSync('src/App.tsx', 'utf-8');
appTsx = appTsx.replace(/onOpenHtmlModal=\{[^}]*\}/, "");
fs.writeFileSync('src/App.tsx', appTsx);

// 3. Fix EditMode.tsx
let editMode = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');
if (!editMode.includes('useEffect')) {
  editMode = editMode.replace("import React, { useState } from 'react';", "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';");
}
// Replace React.useMemo with useMemo
editMode = editMode.replace(/React\.useMemo/g, "useMemo");
editMode = editMode.replace(/React\.useCallback/g, "useCallback");
editMode = editMode.replace(/React\.useRef/g, "useRef");

// Remove anything with currentPage, pageSize, filterMode, totalPages
const lines = editMode.split('\n');
const newLines = [];
let skipBlock = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes("const totalPages =")) continue;
  if (line.includes("setCurrentPage(1)")) continue;
  if (line.includes("filterMode === ")) continue;
  if (line.includes("setFilterMode(")) continue;
  if (line.includes("disabled={currentPage <=")) continue;
  if (line.includes("disabled={currentPage >=")) continue;
  if (line.includes("עמוד {currentPage}")) continue;
  if (line.includes("const [currentPage")) continue;
  if (line.includes("const [pageSize")) continue;
  if (line.includes("const [filterMode")) continue;
  
  // Skip the bottom pagination block entirely if it's still there
  if (line.includes("{/* Bottom Pagination */}")) {
    skipBlock = true;
    continue;
  }
  if (skipBlock) {
    if (line.match(/<\/div>\s*$/) && newLines[newLines.length - 1].match(/<\/div>/)) {
      // rough heuristic, we already replaced the bottom block in prep_editmode.ts but let's be careful
    }
    // we'll just skip 10 lines
  }
  
  newLines.push(line);
}

fs.writeFileSync('src/components/EditMode.tsx', newLines.join('\n'));
