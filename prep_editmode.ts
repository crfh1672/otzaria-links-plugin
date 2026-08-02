import fs from 'fs';
let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// 1. Add sortMode to props
content = content.replace(
  "  onToggleNavDrawer?: () => void;\n}",
  "  onToggleNavDrawer?: () => void;\n  sortMode?: 'book_order' | 'score_asc' | 'score_desc';\n}"
);

content = content.replace(
  "  onToggleNavDrawer\n}) => {",
  "  onToggleNavDrawer,\n  sortMode = 'book_order'\n}) => {"
);

// 2. Remove pagination and filter states, add Drawer tab state
content = content.replace(
  "  // Pagination & Filtering state\n  const [currentPage, setCurrentPage] = useState(1);\n  const [pageSize] = useState(40);\n  const [sourceSearchQuery, setSourceSearchQuery] = useState('');\n  const [filterMode, setFilterMode] = useState<'all' | 'linked' | 'unlinked' | 'high_confidence' | 'low_confidence' | 'pending'>('all');",
  "  // Filtering & Drawer state\n  const [sourceSearchQuery, setSourceSearchQuery] = useState('');\n  const [drawerTab, setDrawerTab] = useState<'nav' | 'search'>('nav');"
);

// 3. Update updateSvgLines to not depend on currentPage/filterMode
content = content.replace(
  "  }, [updateSvgLines, filterMode, currentPage]);",
  "  }, [updateSvgLines, sortMode]);"
);
content = content.replace(
  "  }, [commentaryLines, commentarySegments, isNavDrawerOpen]);",
  "  }, [commentaryLines, commentarySegments, isNavDrawerOpen]);\n\n  useEffect(() => {\n    if (isNavDrawerOpen) {\n      updateSvgLines();\n    }\n  }, [isNavDrawerOpen, updateSvgLines]);"
);

// 4. Update filteredCommentaryIndices
const filteredIndicesMatch = /const filteredCommentaryIndices = React\.useMemo\(\(\) => \{[\s\S]*?\}, \[commentaryLines, links, sourceSearchQuery, filterMode\]\);/;
const newFilteredIndices = `
  const sortedCommentaryIndices = React.useMemo(() => {
    let indices: number[] = [];
    const q = sourceSearchQuery.toLowerCase().trim();

    commentaryLines.forEach((line, idx) => {
      const commLineIdx1 = idx + 1;
      if (!line.trim() || /<h[1-6][^>]*>.*<\\/h[1-6]>/i.test(line) || /^#{1,6}\\s+/.test(line)) {
        return;
      }
      const link = links.find(l => l.line_index_1 === commLineIdx1);

      if (q) {
        if (!line.toLowerCase().includes(q)) {
          if (!link) return;
          const targetLine = link.secondaryTarget === 'rashi' 
            ? rashiLines[link.secondary_line_index! - 1]
            : link.secondaryTarget === 'tosafot'
              ? tosafotLines[link.secondary_line_index! - 1]
              : sourceLines[link.line_index_2 - 1];
          if (!targetLine || !targetLine.toLowerCase().includes(q)) return;
        }
      }
      indices.push(commLineIdx1);
    });

    if (sortMode !== 'book_order') {
       indices.sort((a, b) => {
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
`;

content = content.replace(filteredIndicesMatch, newFilteredIndices);

// 5. Remove currentPageIndices and totalPages and pagination effect
content = content.replace(/const totalPages = Math\.ceil\(filteredCommentaryIndices\.length \/ pageSize\);[\s\S]*?const currentPageIndices = React\.useMemo\(\(\) => \{[\s\S]*?\}, \[filteredCommentaryIndices, currentPage, pageSize\]\);/, "");

// 6. Rename currentPageGroups to groupedCommentary
content = content.replace(
  "const currentPageGroups = React.useMemo(() => {",
  "const groupedCommentary = React.useMemo(() => {"
);
content = content.replace("currentPageIndices.forEach(idx => {", "sortedCommentaryIndices.forEach(idx => {");
content = content.replace("}, [currentPageIndices, links]);", "}, [sortedCommentaryIndices, links]);");

// 7. Render - Replace currentPageGroups with groupedCommentary
content = content.replace(/currentPageGroups/g, "groupedCommentary");

// 8. Remove Filter Sticky Toolbar
const filterToolbarMatch = /{?\/\*\s*Secondary Sticky Header: Filter & Search\s*\*\/[\s\S]*?{\/\*\s*Main Unified List\s*\*\/}/;
content = content.replace(filterToolbarMatch, "{/* Main Unified List */}");

// Remove bottom pagination
const bottomPaginationMatch = /{\/\*\s*Bottom Pagination\s*\*\/[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
content = content.replace(bottomPaginationMatch, "      </div>\n    </div>\n  </div>");

fs.writeFileSync('src/components/EditMode.tsx', content);
