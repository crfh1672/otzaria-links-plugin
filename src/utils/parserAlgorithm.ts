import { OtzariaLink, PluginConfig, DHHighlight } from '../types';

/**
 * Normalizes Hebrew text for search/comparison only.
 * Removes Nikud, teamim, HTML tags, and punctuation (except . and : when specified).
 */
export function normalizeText(text: string, keepColonsAndDots: boolean = false): string {
  if (!text) return '';
  
  // 1. Normalize quotes and remove HTML tags
  let cleaned = normalizeHebrewQuotes(text).replace(/<[^>]*>/g, ' ');
  
  // 2. Remove Nikud and Cantillation (teamim): U+0591 to U+05C7
  cleaned = cleaned.replace(/[\u0591-\u05C7]/g, '');

  if (keepColonsAndDots) {
    // Keep letters, digits, spaces, ., :, ' and "
    cleaned = cleaned.replace(/[^\u05D0-\u05EA0-9\s.:'"]+/g, ' ');
  } else {
    // Keep letters, digits, spaces, ' and "
    cleaned = cleaned.replace(/[^\u05D0-\u05EA0-9\s'\"]+/g, ' ');
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
 * Keywords for Secondary Source routing
 */
const RASHI_KEYWORDS = [
  'רש"י', 'רשד"ה', 'רש"י ד"ה', 'ברש"י ד"ה', 'ברשד"ה', 'ברש"י', 'רש"י בד"ה', 'רשי', 'ברשי', 'פירש"י', 'פרש"י'
];

// Includes both quoted and plain variants for תוספות citations, e.g. תוס' and תוס
const TOSAFOT_KEYWORDS = [
  'תוספות', 'תוס', 'תוסות', 'תוספות ד"ה', 'תוס ד"ה', 'תוסות ד"ה', 'תוד"ה', 'תוס\'',
  'תוס\' ד"ה', 'תוס\' בד"ה', 'בתוס\'', 'בתוס', 'בתוסות', 'בתוס\' ד"ה', 'בתוס ד"ה',
  'בתוסות ד"ה', 'בתוסות', 'בתוספות', 'בתוספות ד"ה', 'בתוד"ה', 'תוספות בד"ה',
  'בתוס\' בד"ה', 'בתוס ד"ה', 'בתוס בד"ה', 'בתו\' ד"ה', 'תו\' ד"ה', 'תו\' בד"ה',
  'תו ד"ה', 'תו בד"ה'
];

const getSecondaryPath = (targetSecondary: 'rashi' | 'tosafot', targetBookName: string) =>
  targetSecondary === 'rashi'
    ? `רש"י על ${targetBookName}.txt`
    : `תוספות על ${targetBookName}.txt`;

const getSecondaryBookLabel = (targetSecondary: 'rashi' | 'tosafot') =>
  targetSecondary === 'rashi' ? 'רש"י' : 'תוספות';

/**
 * Strips leading secondary source citation prefixes (e.g. רש"י ד"ה, תוספות ד"ה)
 * to leave clean Dibur Hamatchil for searching secondary and primary texts.
 */
export function normalizeHebrewQuotes(text: string): string {
  if (!text) return '';
  return text
    .replace(/[׳’‘´]/g, "'") // Added '´' for broader single quote normalization
    .replace(/[״“”]/g, '"');
}

export function stripSecondaryPrefix(line: string): string {
  if (!line) return '';
  let cleaned = normalizeHebrewQuotes(line.trim());
  cleaned = cleaned.replace(/^(ברש"י\s+ד"ה|רש"י\s+ד"ה|רשד"ה|רשדה|ברשד"ה|ברשדה|ברש"י\s+בד"ה|רש"י\s+בד"ה|ברש"י|רש"י|רשי\s+ד"ה|רשי\s+דה|רשי|ברשי\s+ד"ה|ברשי\s+דה|ברשי|בתוספות\s+ד"ה|תוספות\s+ד"ה|בתוס'\s+ד"ה|תוס'\s+ד"ה|בתוס\s+ד"ה|תוס\s+ד"ה|בתוסות\s+ד"ה|תוסות\s+ד"ה|בתוד"ה|תוד"ה|בתוסות\s+בד"ה|תוספות\s+בד"ה|בתוס'\s+בד"ה|תוס'\s+בד"ה|בתוס\s+בד"ה|תוס\s+בד"ה|בתוס|תוס|בתוסות|תוסות|בתוספות|תוספות|בתוס'|תוס'|בתו'\s+ד"ה|תו'\s+ד"ה|תו'\s+בד"ה|תו\s+ד"ה|תו\s+בד"ה|שם\s+ד"ה|או"ד|באו"ד|א"ד|בא"ד|אד|באד|אוד|באוד|בד"ה|בדה)\s*[:.\-]?\s*/i, '');
  cleaned = cleaned.replace(/^ד"ה\s*[:.\-]?\s*/i, '');
  return cleaned.trim();
}

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

  // 1. If custom delimiter defined, non-empty, and present in line
  if (delimiter && delimiter.trim() && line.includes(delimiter.trim())) {
    const trimmedDelim = delimiter.trim();
    const idx = line.indexOf(trimmedDelim);
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
  // 3. Fallback when no delimiter configured: do NOT truncate automatically on '.' or ':'
  else {
    dhPart = line;
    explicit = false;
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
  tosafotRaw?: string,
  rashiLinks?: any[],
  tosafotLinks?: any[]
): {
  links: OtzariaLink[];
  commentaryLines: string[];
  sourceLines: string[];
  rashiLines?: string[];
  tosafotLines?: string[];
  dhHighlights: Record<number, DHHighlight>;
} {
  console.log(`\n🚀 runLinkingParser START: config.targetBookName='${config.targetBookName}', rashiRaw=${!!rashiRaw}, tosafotRaw=${!!tosafotRaw}`);
  const commDoc = parseDocumentSegments(commentaryRaw);
  const srcDoc = parseDocumentSegments(sourceRaw);
  const rashiDoc = rashiRaw ? parseDocumentSegments(rashiRaw) : null;
  const tosafotDoc = tosafotRaw ? parseDocumentSegments(tosafotRaw) : null;

  console.log(`  📄 commDoc.segments=${commDoc.segments.length}, srcDoc.segments=${srcDoc.segments.length}, rashiDoc=${rashiDoc ? rashiDoc.segments.length : 'null'}, tosafotDoc=${tosafotDoc ? tosafotDoc.segments.length : 'null'}`);

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
      // Normalize the prefix line fully for keyword matching (includes nikud removal, quote normalization)
      const normalizedPrefixLine = normalizeText(trimmedLine, false);

      console.log(`\n📝 Line ${cLineIdx}: '${trimmedLine.substring(0, 50)}...' → normalizedPrefixLine='${normalizedPrefixLine.substring(0, 50)}...'`);

      // Check routing to secondary sources (Step 4)
      let targetSecondary: 'rashi' | 'tosafot' | null = null;
      let explicitSecondaryTarget = false;

      if (RASHI_KEYWORDS.some(kw => normalizedPrefixLine.startsWith(kw))) {
        targetSecondary = 'rashi';
        explicitSecondaryTarget = true;
        console.log(`  ✅ Detected Rashi keyword. normalizedPrefixLine='${normalizedPrefixLine}'`);
      } else if (TOSAFOT_KEYWORDS.some(kw => normalizedPrefixLine.startsWith(normalizeText(kw, false)))) {
        targetSecondary = 'tosafot';
        explicitSecondaryTarget = true;
        console.log(`  ✅ Detected Tosafot keyword. normalizedPrefixLine='${normalizedPrefixLine}'`);
      } else {
        const baadRegex = /^(?:שם\s+)?(?:או"ד|באו"ד|א"ד|בא"ד|אד|באד|אוד|באוד|בד"ה|בדה)(?:\s|$|[:.\-])/i;
        if (normalizedPrefixLine.match(baadRegex)) {
          targetSecondary = previousSecondaryType;
          if (targetSecondary) explicitSecondaryTarget = true;
        }
      }

      const baadRegexAll = /^(?:שם\s+)?(?:או"ד|באו"ד|א"ד|בא"ד|אד|באד|אוד|באוד|בד"ה|בדה)(?:\s|$|[:.\-])/i;
      const isBaad = Boolean(normalizedPrefixLine.match(baadRegexAll));

      // Handle Inheritance ("שם" - Step 5)
      const startsWithSham = trimmedLine.startsWith('שם') || isBaad;
      let isInherited = false;

      // Extract DH search text using stripped line if secondary prefix present
      const lineForDh = stripSecondaryPrefix(trimmedLine);
      console.log(`  🔍 lineForDh='${lineForDh}' (after stripSecondaryPrefix)`);
      // For secondary target explicit lines, if stripSecondaryPrefix returns empty, skip this line
      if (explicitSecondaryTarget && !lineForDh.trim()) {
        console.log(`  ⏭️  SKIP: explicit secondary but no DH text`);
        continue; // No DH text after removing secondary prefix - skip this commentary line
      }
      // For non-explicit lines, use lineForDh or fallback to trimmedLine
      const lineForDhExtraction = lineForDh.trim() ? lineForDh : trimmedLine;
      console.log(`  🔎 lineForDhExtraction='${lineForDhExtraction}'`);
      const { dhText, cleanDh, isExplicitDelimiter } = extractDiburHamatchil(lineForDhExtraction, config.diburHamatchilDelimiter);
      console.log(`  📌 dhText='${dhText}', cleanDh='${cleanDh}', isExplicitDelimiter=${isExplicitDelimiter}`);

      let matchedSourceLineNum: number | null = null;
      let matchedSecondaryLineNum: number | null = null;

      // Primary search function: matches phrase or finds longest contiguous matching prefix from commentary line
      const searchLineInDoc = (
        docLines: string[],
        start: number,
        end: number,
        searchPhrase: string,
        fullLineText: string,
        isExplicit: boolean
      ): { lineNum: number | null; matchedCount: number } => {
        if (!docLines || docLines.length === 0) {
          console.log(`    ⚠️ searchLineInDoc: docLines is empty!`);
          return { lineNum: null, matchedCount: 0 };
        }

        const validStart = Math.max(1, Math.min(start, docLines.length));
        const validEnd = Math.max(validStart, Math.min(end, docLines.length));

        const searchWords = searchPhrase.split(/\s+/).filter(Boolean);
        const fullWords = normalizeText(fullLineText).split(/\s+/).filter(Boolean);

        console.log(`    📊 searchLineInDoc: validStart=${validStart}, validEnd=${validEnd}, searchWords=[${searchWords.join(',')}], fullWords=[${fullWords.join(',')}], isExplicit=${isExplicit}`);

        const searchRanges = [
          { s: validStart, e: validEnd }
        ];

        for (const range of searchRanges) {
          let bestLine: number | null = null;
          let maxMatchedCount = 0;
          let minDistance = Infinity;
          let linesChecked = 0;

          for (let lNum = range.s; lNum <= range.e; lNum++) {
            const docLineRaw = docLines[lNum - 1];
            if (!docLineRaw) continue;
            const docLineNorm = normalizeText(docLineRaw);
            if (!docLineNorm) continue;

            linesChecked++;
            const docWords = docLineNorm.split(/\s+/).filter(Boolean);
            if (docWords.length === 0) continue;

            let currentMatchCount = 0;

            if (isExplicit) {
              // Explicit delimiter / כו': search for searchPhrase in docLineNorm
              if (docLineNorm.includes(searchPhrase)) {
                currentMatchCount = searchWords.length + 5;
              } else {
                let matched = 0;
                searchWords.forEach(w => {
                  if (docLineNorm.includes(w)) matched++;
                });
                currentMatchCount = matched;
              }
            } else {
              // No explicit delimiter: find longest contiguous sequence of words starting from start of commentary line
              for (let startWIdx = 0; startWIdx < fullWords.length; startWIdx++) {
                for (let docWIdx = 0; docWIdx < docWords.length; docWIdx++) {
                  let k = 0;
                  while (
                    startWIdx + k < fullWords.length &&
                    docWIdx + k < docWords.length &&
                    fullWords[startWIdx + k] === docWords[docWIdx + k]
                  ) {
                    k++;
                  }
                  if (k > currentMatchCount) {
                    currentMatchCount = k;
                  }
                }
              }
            }

            const minThreshold = isExplicit 
              ? Math.min(2, Math.max(1, searchWords.length))
              : Math.min(2, Math.max(1, fullWords.length));

            if (currentMatchCount >= minThreshold) {
              const dist = Math.abs(lNum - range.s);
              if (currentMatchCount > maxMatchedCount) {
                maxMatchedCount = currentMatchCount;
                bestLine = lNum;
                minDistance = dist;
              } else if (currentMatchCount === maxMatchedCount && dist < minDistance) {
                bestLine = lNum;
                minDistance = dist;
              }
            }
          }

          console.log(`    ✓ searchLineInDoc checked ${linesChecked} lines, bestLine=${bestLine}, maxMatchedCount=${maxMatchedCount}`);
          if (bestLine !== null) {
            return { lineNum: bestLine, matchedCount: maxMatchedCount };
          }
        }

        return { lineNum: null, matchedCount: 0 };
      };

      let srcMatchRes = { lineNum: null as number | null, matchedCount: 0 };
      let secMatchRes = { lineNum: null as number | null, matchedCount: 0 };

      // Search in secondary source if routed (unless it's 'בא"ד', in which case we don't search, we inherit)
      if (!isBaad && targetSecondary === 'rashi' && rashiDoc) {
        console.log(`🔍 Searching for Rashi: keyword='${normalizedPrefixLine}', cleanDh='${cleanDh}', lineForDhExtraction='${lineForDhExtraction}'`);
        secMatchRes = searchLineInDoc(
          rashiDoc.lines,
          rashiSeg ? rashiSeg.startLine : 1,
          rashiSeg ? rashiSeg.endLine : rashiDoc.lines.length,
          cleanDh,
          lineForDhExtraction,
          isExplicitDelimiter
        );
        console.log(`  → Rashi search result: lineNum=${secMatchRes.lineNum}, matchedCount=${secMatchRes.matchedCount}`);
        matchedSecondaryLineNum = secMatchRes.lineNum;
      } else if (!isBaad && targetSecondary === 'tosafot' && tosafotDoc) {
        console.log(`🔍 Searching for Tosafot: keyword='${normalizedPrefixLine}', cleanDh='${cleanDh}', lineForDhExtraction='${lineForDhExtraction}'`);
        secMatchRes = searchLineInDoc(
          tosafotDoc.lines,
          tosafotSeg ? tosafotSeg.startLine : 1,
          tosafotSeg ? tosafotSeg.endLine : tosafotDoc.lines.length,
          cleanDh,
          lineForDhExtraction,
          isExplicitDelimiter
        );
        console.log(`  → Tosafot search result: lineNum=${secMatchRes.lineNum}, matchedCount=${secMatchRes.matchedCount}`);
        matchedSecondaryLineNum = secMatchRes.lineNum;
      }

      // Search in primary source segment unless the line explicitly targets a secondary source or is 'בא"ד' (which means inherit previous).
      if (!explicitSecondaryTarget && !isBaad) {
        console.log(`🔍 Searching PRIMARY source: lineForDhExtraction='${lineForDhExtraction}', cleanDh='${cleanDh}', isExplicit=${isExplicitDelimiter}`);
        srcMatchRes = searchLineInDoc(
          srcDoc.lines,
          srcSeg ? srcSeg.startLine : 1,
          srcSeg ? srcSeg.endLine : srcDoc.lines.length,
          cleanDh,
          lineForDhExtraction,
          isExplicitDelimiter
        );
        console.log(`  → PRIMARY source result: lineNum=${srcMatchRes.lineNum}, matchedCount=${srcMatchRes.matchedCount}`);
        matchedSourceLineNum = srcMatchRes.lineNum;
      }

      // If secondary source line was found and this is an explicit secondary citation,
      // use the secondary source as the actual target instead of mapping back to the primary source.
      if (explicitSecondaryTarget && matchedSecondaryLineNum) {
        matchedSourceLineNum = matchedSecondaryLineNum;
      }

      // If secondary source line was found, but primary source line wasn't matched directly:
      if (!explicitSecondaryTarget && matchedSecondaryLineNum && !matchedSourceLineNum) {
        let mappedPrimaryLine = previousLink?.line_index_2 || lastMatchedSrcLineIndex || (srcSeg ? srcSeg.startLine : 1);
        
        if (targetSecondary === 'rashi' && rashiLinks && rashiLinks.length > 0) {
           const link = rashiLinks.find(l => l.line_index_1 === matchedSecondaryLineNum);
           if (link) mappedPrimaryLine = link.line_index_2;
        } else if (targetSecondary === 'tosafot' && tosafotLinks && tosafotLinks.length > 0) {
           const link = tosafotLinks.find(l => l.line_index_1 === matchedSecondaryLineNum);
           if (link) mappedPrimaryLine = link.line_index_2;
        }

        matchedSourceLineNum = mappedPrimaryLine;
        // mark as inherited only when the source is derived due to a cross-reference fallback,
        // not when the line is explicitly a secondary-target citation itself.
        if (!explicitSecondaryTarget) {
          isInherited = true;
        }
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
      // Only inherit when this is not an explicit secondary citation.
      if (!matchedSourceLineNum && !explicitSecondaryTarget && previousLink && previousLink.line_index_2) {
        matchedSourceLineNum = previousLink.line_index_2;
        matchedSecondaryLineNum = previousLink.secondary_line_index || null;
        targetSecondary = previousLink.secondaryTarget || null;
        isInherited = true;
      }

      // If we got a source line match, create OtzariaLink
      if (matchedSourceLineNum) {
        lastMatchedSrcLineIndex = matchedSourceLineNum;
        
        // Fallback for older UI-created links or incomplete inheritance
        if (targetSecondary && !matchedSecondaryLineNum) {
           matchedSecondaryLineNum = matchedSourceLineNum;
        }

        const isSecondaryLink = Boolean(targetSecondary);
        if (isSecondaryLink) {
          console.log(`🔗 Line ${cLineIdx}: Creating SECONDARY link: targetSecondary=${targetSecondary}, matchedSecondaryLineNum=${matchedSecondaryLineNum}, matchedSourceLineNum=${matchedSourceLineNum}`);
        }
        
        const headerTitle = isSecondaryLink
          ? (targetSecondary === 'rashi' ? rashiSeg?.headerTitle : tosafotSeg?.headerTitle) || config.targetBookName
          : srcSeg ? srcSeg.headerTitle : config.targetBookName;
        const heRef = isSecondaryLink
          ? `${getSecondaryBookLabel(targetSecondary!)} - ${headerTitle}`
          : `${config.targetBookName} - ${headerTitle}`;
        const path_2 = isSecondaryLink
          ? getSecondaryPath(targetSecondary!, config.targetBookName)
          : `${config.targetBookName}.txt`;

        const newLink: OtzariaLink = {
          line_index_1: cLineIdx,
          line_index_2: matchedSourceLineNum,
          heRef_2: heRef,
          path_2,
          connection_type: "commentary",
          secondaryTarget: targetSecondary || undefined,
          secondary_line_index: matchedSecondaryLineNum || undefined,
          secondaryRef: isSecondaryLink ? `${getSecondaryBookLabel(targetSecondary!)} (${headerTitle})` : undefined,
          isInherited,
          dhText: dhText || cleanDh
        };

        links.push(newLink);
        previousLink = newLink;
        previousSecondaryType = targetSecondary;
      }

      // Calculate initial DH word highlight range (words count)
      const wordsInLine = trimmedLine.split(/\s+/).filter(Boolean);
      let dhWordCount = 0;
      if (isExplicitDelimiter && dhText) {
        dhWordCount = dhText.split(/\s+/).filter(Boolean).length;
      } else {
        dhWordCount = srcMatchRes.matchedCount > 0 
          ? srcMatchRes.matchedCount 
          : (secMatchRes.matchedCount > 0 ? secMatchRes.matchedCount : Math.min(4, wordsInLine.length));
      }

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
