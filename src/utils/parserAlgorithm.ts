import { OtzariaLink, PluginConfig, DHHighlight } from '../types';

/**
 * Normalizes Hebrew text for search/comparison only.
 * Removes Nikud, teamim, HTML tags, and punctuation (except . and : when specified).
 */
export function normalizeText(text: string, keepColonsAndDots: boolean = false): string {
  if (!text) return '';
  
  // 1. Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, ' ');
  
  // 2. Remove Nikud and Cantillation (teamim): U+0591 to U+05C7
  cleaned = cleaned.replace(/[\u0591-\u05C7]/g, '');

  if (keepColonsAndDots) {
    // Keep letters, digits, spaces, . and :
    cleaned = cleaned.replace(/[^\u05D0-\u05EA0-9\s.:]/g, ' ');
  } else {
    // Keep letters, digits, spaces only
    cleaned = cleaned.replace(/[^\u05D0-\u05EA0-9\s]/g, ' ');
  }

  // Normalize spaces
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts header titles from text line if line is a header tag (e.g. <h1>...</h1>, # ...)
 */
export function isHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  return /<h[1-6][^>]*>.*<\/h[1-6]>/i.test(trimmed) || /^#{1,6}\s+/.test(trimmed);
}

export function extractHeaderTitle(line: string): string {
  const trimmed = line.trim();
  const htmlMatch = trimmed.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
  if (htmlMatch) return htmlMatch[1];
  const mdMatch = trimmed.match(/^#{1,6}\s+(.*)/);
  if (mdMatch) return mdMatch[1];
  return trimmed;
}

/**
 * Compares two header strings according to SRS rule:
 * Ignore header level, ignore punctuation EXCEPT '.' and ':', match normalized text.
 */
export function areHeadersMatching(h1: string, h2: string): boolean {
  const norm1 = normalizeText(extractHeaderTitle(h1), true);
  const norm2 = normalizeText(extractHeaderTitle(h2), true);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
}

/**
 * Keywords for Secondary Source routing in Shas
 */
const RASHI_KEYWORDS = [
  'רש"י', 'רשד"ה', 'רש"י ד"ה', 'ברש"י ד"ה', 'ברשד"ה', 'ברש"י', 'רש"י בד"ה', 'רשי'
];

const TOSAFOT_KEYWORDS = [
  'תוספות', 'תוספות ד"ה', 'תוד"ה', 'תוס\'', 'תוס\' ד"ה', 'בתוס\'', 'בתוספות',
  'בתוס\' ד"ה', 'בתוספות ד"ה', 'בתוד"ה', 'תוס\' בד"ה', 'תוספות בד"ה', 'בתו\' ד"ה',
  'תו\' ד"ה', 'תו\' בד"ה', 'תוספות'
];

export interface HeaderSegment {
  headerTitle: string;
  headerLineIndex: number; // 1-based physical line index
  startLine: number;       // First content line after header
  endLine: number;         // Last line in section
}

/**
 * Breaks a full document string into physical lines and header segments.
 * Strictly preserves physical line breaks (\n / \r\n).
 */
export function parseDocumentSegments(rawText: string): { lines: string[]; segments: HeaderSegment[] } {
  const lines = rawText.split(/\r?\n/);
  const segments: HeaderSegment[] = [];
  
  let currentHeader: HeaderSegment | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1; // 1-based
    if (isHeaderLine(lines[i])) {
      if (currentHeader) {
        currentHeader.endLine = i; // Line before current header
        segments.push(currentHeader);
      }
      currentHeader = {
        headerTitle: extractHeaderTitle(lines[i]),
        headerLineIndex: lineNum,
        startLine: lineNum + 1,
        endLine: lines.length
      };
    }
  }

  if (currentHeader) {
    currentHeader.endLine = lines.length;
    segments.push(currentHeader);
  } else if (lines.length > 0) {
    // If no header found, wrap whole document in single general segment
    segments.push({
      headerTitle: "תוכן ראשי",
      headerLineIndex: 0,
      startLine: 1,
      endLine: lines.length
    });
  }

  return { lines, segments };
}

/**
 * Extracts potential Dibur Hamatchil search phrase from commentary line.
 */
export function extractDiburHamatchil(
  line: string,
  delimiter?: string
): { dhText: string; cleanDh: string; isExplicitDelimiter: boolean } {
  const normLine = normalizeText(line, true);
  if (!normLine) return { dhText: '', cleanDh: '', isExplicitDelimiter: false };

  let dhPart = '';
  let explicit = false;

  // 1. If custom delimiter defined
  if (delimiter && line.includes(delimiter)) {
    const idx = line.indexOf(delimiter);
    dhPart = line.substring(0, idx);
    explicit = true;
  }
  // 2. Check for כו' or וכו'
  else if (/\bו?כו'/i.test(line)) {
    const match = line.match(/^(.*?)\bו?כו'/i);
    if (match) {
      dhPart = match[1];
      explicit = true;
    }
  }
  // 3. Fallback: take up to first period or colon if present, or first 6 words
  else if (line.includes('.')) {
    dhPart = line.substring(0, line.indexOf('.'));
    explicit = true;
  } else if (line.includes(':')) {
    dhPart = line.substring(0, line.indexOf(':'));
    explicit = true;
  } else {
    // First 5-8 words
    const words = line.split(/\s+/).filter(Boolean);
    dhPart = words.slice(0, Math.min(6, words.length)).join(' ');
  }

  const cleanDh = normalizeText(dhPart);
  return { dhText: dhPart.trim(), cleanDh, isExplicitDelimiter: explicit };
}

/**
 * Main 5-Step Parser Execution Engine
 */
export function runLinkingParser(
  commentaryRaw: string,
  sourceRaw: string,
  config: PluginConfig,
  rashiRaw?: string,
  tosafotRaw?: string
): {
  links: OtzariaLink[];
  commentaryLines: string[];
  sourceLines: string[];
  rashiLines?: string[];
  tosafotLines?: string[];
  dhHighlights: Record<number, DHHighlight>;
} {
  const commDoc = parseDocumentSegments(commentaryRaw);
  const srcDoc = parseDocumentSegments(sourceRaw);
  const rashiDoc = rashiRaw ? parseDocumentSegments(rashiRaw) : null;
  const tosafotDoc = tosafotRaw ? parseDocumentSegments(tosafotRaw) : null;

  const links: OtzariaLink[] = [];
  const dhHighlights: Record<number, DHHighlight> = {};

  let previousLink: OtzariaLink | null = null;
  let previousSecondaryType: 'rashi' | 'tosafot' | null = null;

  // Map source header segments to commentary header segments
  commDoc.segments.forEach(commSeg => {
    // Find matching source segment
    const srcSeg = srcDoc.segments.find(s => areHeadersMatching(commSeg.headerTitle, s.headerTitle));
    const rashiSeg = rashiDoc ? rashiDoc.segments.find(s => areHeadersMatching(commSeg.headerTitle, s.headerTitle)) : null;
    const tosafotSeg = tosafotDoc ? tosafotDoc.segments.find(s => areHeadersMatching(commSeg.headerTitle, s.headerTitle)) : null;

    let lastMatchedSrcLineIndex = srcSeg ? srcSeg.startLine : 1;

    for (let cLineIdx = commSeg.startLine; cLineIdx <= commSeg.endLine; cLineIdx++) {
      if (cLineIdx > commDoc.lines.length) break;
      const cLineRaw = commDoc.lines[cLineIdx - 1];
      if (!cLineRaw || isHeaderLine(cLineRaw) || !cLineRaw.trim()) continue;

      const trimmedLine = cLineRaw.trim();
      const normCommLine = normalizeText(trimmedLine);

      // Check routing to secondary sources (Step 4 - Shas Mode)
      let targetSecondary: 'rashi' | 'tosafot' | null = null;

      if (config.sourceCategory === 'shas') {
        if (RASHI_KEYWORDS.some(kw => trimmedLine.startsWith(kw))) {
          targetSecondary = 'rashi';
        } else if (TOSAFOT_KEYWORDS.some(kw => trimmedLine.startsWith(kw))) {
          targetSecondary = 'tosafot';
        } else if (trimmedLine.startsWith('שם ד"ה') || trimmedLine.startsWith('או"ד') || trimmedLine.startsWith('באו"ד')) {
          targetSecondary = previousSecondaryType;
        }
      }

      // Handle Inheritance ("שם" - Step 5)
      const startsWithSham = trimmedLine.startsWith('שם');
      let isInherited = false;

      // Extract DH search text
      const { dhText, cleanDh } = extractDiburHamatchil(trimmedLine, config.diburHamatchilDelimiter);

      let matchedSourceLineNum: number | null = null;
      let matchedSecondaryLineNum: number | null = null;

      // Primary fuzzy search function within a range
      const findMatchingLine = (docLines: string[], start: number, end: number, searchPhrase: string): number | null => {
        if (!searchPhrase || searchPhrase.length < 2) return null;
        
        const words = searchPhrase.split(/\s+/).filter(Boolean);
        let bestLine: number | null = null;
        let maxMatchCount = 0;

        // Try searching from last matched position first
        const searchOrder: number[] = [];
        for (let l = start; l <= end; l++) {
          if (l <= docLines.length) searchOrder.push(l);
        }

        for (const lNum of searchOrder) {
          const docLineNorm = normalizeText(docLines[lNum - 1]);
          if (!docLineNorm) continue;

          // Check if full phrase exists or count matching words
          if (docLineNorm.includes(searchPhrase)) {
            return lNum; // Exact match found
          }

          let matchedWords = 0;
          words.forEach(w => {
            if (docLineNorm.includes(w)) matchedWords++;
          });

          if (matchedWords >= 2 && matchedWords > maxMatchCount) {
            maxMatchCount = matchedWords;
            bestLine = lNum;
          }
        }

        return (maxMatchCount >= Math.min(2, words.length)) ? bestLine : null;
      };

      // Search in secondary source if routed
      if (targetSecondary === 'rashi' && rashiDoc && rashiSeg) {
        matchedSecondaryLineNum = findMatchingLine(
          rashiDoc.lines,
          rashiSeg.startLine,
          rashiSeg.endLine,
          cleanDh
        );
      } else if (targetSecondary === 'tosafot' && tosafotDoc && tosafotSeg) {
        matchedSecondaryLineNum = findMatchingLine(
          tosafotDoc.lines,
          tosafotSeg.startLine,
          tosafotSeg.endLine,
          cleanDh
        );
      }

      // Search in primary source segment
      if (srcSeg) {
        matchedSourceLineNum = findMatchingLine(
          srcDoc.lines,
          srcSeg.startLine,
          srcSeg.endLine,
          cleanDh
        );
      }

      // Rule for 'שם' inheritance
      if (startsWithSham) {
        if (!config.ignoreShamInShas || !matchedSourceLineNum) {
          if (previousLink) {
            matchedSourceLineNum = previousLink.line_index_2;
            matchedSecondaryLineNum = previousLink.secondary_line_index || null;
            targetSecondary = previousLink.secondaryTarget || null;
            isInherited = true;
          }
        }
      }

      // If no direct match found, check fallback inheritance from previous link under same header
      if (!matchedSourceLineNum && previousLink && previousLink.line_index_2) {
        matchedSourceLineNum = previousLink.line_index_2;
        isInherited = true;
      }

      // If we got a source line match, create OtzariaLink
      if (matchedSourceLineNum) {
        lastMatchedSrcLineIndex = matchedSourceLineNum;
        
        // Build Hebrew reference (e.g. "בראשית פרק א, שורה 3")
        const headerTitle = srcSeg ? srcSeg.headerTitle : config.targetBookName;
        const heRef = `${config.targetBookName} - ${headerTitle}`;

        const newLink: OtzariaLink = {
          line_index_1: cLineIdx,
          line_index_2: matchedSourceLineNum,
          heRef_2: heRef,
          path_2: `${config.targetBookName}.txt`,
          connection_type: "commentary",
          secondaryTarget: targetSecondary || undefined,
          secondary_line_index: matchedSecondaryLineNum || undefined,
          secondaryRef: targetSecondary ? `${targetSecondary === 'rashi' ? 'רש"י' : 'תוספות'} (${headerTitle})` : undefined,
          isInherited,
          dhText: dhText || cleanDh
        };

        links.push(newLink);
        previousLink = newLink;
        previousSecondaryType = targetSecondary;
      }

      // Calculate initial DH word highlight range (words count)
      const wordsInLine = trimmedLine.split(/\s+/).filter(Boolean);
      const dhWordCount = dhText ? dhText.split(/\s+/).filter(Boolean).length : Math.min(4, wordsInLine.length);
      dhHighlights[cLineIdx] = {
        wordStart: 0,
        wordCount: Math.max(1, Math.min(dhWordCount, wordsInLine.length))
      };
    }
  });

  return {
    links,
    commentaryLines: commDoc.lines,
    sourceLines: srcDoc.lines,
    rashiLines: rashiDoc?.lines,
    tosafotLines: tosafotDoc?.lines,
    dhHighlights
  };
}

/**
 * Formats commentary line text with <b>...</b> applied based on DHHighlight configuration
 */
export function formatLineWithDH(line: string, highlight?: DHHighlight): string {
  if (!line || !line.trim()) return line || '';
  if (!highlight || highlight.wordCount <= 0) return line;

  try {
    const words = line.split(/(\s+)/); // Keep spaces preserved
    const actualWords: { text: string; wordIndex: number; arrayIndex: number }[] = [];
    
    let currentWordIdx = 0;
    for (let i = 0; i < words.length; i++) {
      if (words[i].trim().length > 0) {
        actualWords.push({ text: words[i], wordIndex: currentWordIdx, arrayIndex: i });
        currentWordIdx++;
      }
    }

    if (actualWords.length === 0) return line;

    const startWord = Math.max(0, Math.min(highlight.wordStart, actualWords.length - 1));
    const count = Math.max(1, highlight.wordCount);
    const endWord = Math.min(actualWords.length, startWord + count);

    if (startWord >= actualWords.length || endWord <= 0) return line;

    const startArrIdx = actualWords[startWord]?.arrayIndex;
    const endArrIdx = actualWords[Math.max(0, Math.min(actualWords.length - 1, endWord - 1))]?.arrayIndex;

    if (startArrIdx === undefined || endArrIdx === undefined) return line;

    words[startArrIdx] = '<b>' + words[startArrIdx];
    words[endArrIdx] = words[endArrIdx] + '</b>';

    return words.join('');
  } catch (e) {
    console.error('Error in formatLineWithDH:', e);
    return line;
  }
}
