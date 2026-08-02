import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

const startTag = "// Filtered commentary line array indices";
const endTag = "  const groupedCommentary = useMemo(() => {";

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  const newBlock = `
  const sortedCommentaryIndices = useMemo(() => {
    const indices: number[] = [];
    const q = sourceSearchQuery.toLowerCase().trim();

    commentaryLines.forEach((line, idx) => {
      const commLineIdx1 = idx + 1;
      if (!line.trim() || /<h[1-6][^>]*>.*<\\/h[1-6]>/i.test(line) || /^#{1,6}\\s+/.test(line)) {
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

`;

  content = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
}

fs.writeFileSync('src/components/EditMode.tsx', content);
