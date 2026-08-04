import { OtzariaLink, PluginConfig, DHHighlight } from '../types';
import { expandAbbreviationsInText, DEFAULT_ABBREVIATIONS, NORMALIZED_ABBREVIATIONS_MAP } from '../data/abbreviations';
import { getWordSimilarity, getNikudFingerprint, levenshteinDistance } from './fuzzyUtils';
import { getCombinedWordWeight, calculateDocumentIdfWeights } from './wordWeights';

/**
 * Calculates a confidence score (0-100%) for a generated link.
 */
export function calculateLinkConfidence(
  isInherited: boolean,
  matchScore: number,
  wordLength: number,
  isExplicit: boolean,
  expectedWeight?: number
): number {
  if (isInherited) {
    return 75; // Inherited context / שם / בא"ד
  }
  const denominator = expectedWeight && expectedWeight > 0 ? expectedWeight : wordLength;
  if (isExplicit && matchScore >= denominator + 3) {
    return 98; // Explicit dibur hamatchil exact delimiter match
  }
  if (denominator <= 0) return 70;

  const ratio = matchScore / denominator;
  if (ratio >= 0.90) return 96;
  if (ratio >= 0.75) return 88;
  if (ratio >= 0.55) return 76;
  return 60;
}

/**
 * Normalizes Hebrew text for search/comparison only.
 * Removes Nikud, teamim, HTML tags, and punctuation (except . and : when specified).
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, ' ');
}

export function normalizeText(text: string, keepColonsAndDots: boolean = false): string {
  if (!text) return '';
  
  // 1. Normalize quotes and remove HTML tags
  let cleaned = normalizeHebrewQuotes(stripHtmlTags(text));
  
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

export function normalizeHeaderForComparison(header: string): string {
  if (!header) return '';
  let title = extractHeaderTitle(header);
  title = normalizeHebrewQuotes(title);
  // Normalize Talmudic Daf notation: דף ב. -> דף ב עמוד א, דף ב: -> דף ב עמוד ב
  title = title.replace(/דף\s+([\u05D0-\u05EA]+)\s*\./g, 'דף $1 עמוד א');
  title = title.replace(/דף\s+([\u05D0-\u05EA]+)\s*:/g, 'דף $1 עמוד ב');
  title = title.replace(/דף\s+([\u05D0-\u05EA]+)\s*ע"?א/g, 'דף $1 עמוד א');
  title = title.replace(/דף\s+([\u05D0-\u05EA]+)\s*ע"?ב/g, 'דף $1 עמוד ב');
  
  return normalizeText(title, false);
}

/**
 * Compares two header strings according to SRS rule:
 * Ignore header level, normalize daf/chapter variations, match normalized text.
 */
export function areHeadersMatching(h1: string, h2: string): boolean {
  const norm1 = normalizeHeaderForComparison(h1);
  const norm2 = normalizeHeaderForComparison(h2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
}

/**
 * Keywords for Secondary Source routing.
 * Raw forms — normalized versions (RASHI_KEYWORDS_NORM / TOSAFOT_KEYWORDS_NORM) are
 * computed once below, sorted longest-first, and used for startsWith matching against
 * the already-normalized `normalizedPrefixLine`.
 */
const RASHI_KEYWORDS = [
  // With ד"ה / בד"ה — longest first
  'פירש"י ד"ה', 'פירש"י בד"ה', 'פרש"י ד"ה', 'פרש"י בד"ה',
  'בפירש"י ד"ה', 'בפירש"י בד"ה', 'בפרש"י ד"ה', 'בפרש"י בד"ה',
  'רש"י ד"ה', 'רש"י בד"ה', 'ברש"י ד"ה', 'ברש"י בד"ה',
  'רשי ד"ה', 'רשי בד"ה', 'ברשי ד"ה', 'ברשי בד"ה',
  'רשד"ה', 'ברשד"ה', 'רשדה', 'ברשדה',
  // Without ד"ה
  'פירש"י', 'פרש"י',
  'בפירש"י', 'בפרש"י',
  'ברש"י', 'רש"י', 'ברשי', 'רשי'
];

const TOSAFOT_KEYWORDS = [
  // With ד"ה / בד"ה — longest first
  'בתוספות ד"ה', 'בתוספות בד"ה', 'תוספות ד"ה', 'תוספות בד"ה',
  'בתוסות ד"ה',  'בתוסות בד"ה',  'תוסות ד"ה',  'תוסות בד"ה',
  'בתוס\' ד"ה',  'בתוס\' בד"ה',  'תוס\' ד"ה',  'תוס\' בד"ה',
  'בתוס ד"ה',   'בתוס בד"ה',   'תוס ד"ה',   'תוס בד"ה',
  'בתו\' ד"ה',  'בתו\' בד"ה',  'תו\' ד"ה',  'תו\' בד"ה',
  'בתו ד"ה',   'בתו בד"ה',   'תו ד"ה',   'תו בד"ה',
  'בתוד"ה', 'תוד"ה',
  // Without ד"ה
  'בתוספות', 'תוספות',
  'בתוסות',  'תוסות',
  'בתוס\'',  'תוס\'',
  'בתוס',    'תוס',
  'בתו\'',   'תו\'',
  'בתו',     'תו'
];

function toPrefixAlternation(keywords: string[]): string {
  return [...new Set(keywords)]
    .sort((a, b) => b.length - a.length)
    .map(kw => kw.replace(/\s+/g, '\\s+'))
    .join('|');
}

const RASHI_PREFIX_ALTS = toPrefixAlternation(RASHI_KEYWORDS);
const TOSAFOT_PREFIX_ALTS = toPrefixAlternation(TOSAFOT_KEYWORDS);

const SECONDARY_PREFIX_STRIP_RE = new RegExp(
  `^(?:${RASHI_PREFIX_ALTS}|${TOSAFOT_PREFIX_ALTS}|שם\\s+ד"ה|או"ד|באו"ד|א"ד|בא"ד|אד|באד|אוד|באוד|בד"ה|בדה)\\s*[:.\\-]?\\s*`,
  'i'
);

/**
 * Keywords that indicate the commentary is citing the Gemara (primary Talmud source).
 * These are used to route searches explicitly to the Gemara source document.
 */
const GEMARA_KEYWORDS = [
  'בגמרא', "גמ'", 'גמרא'
];

/**
 * Keywords that indicate the commentary is citing the Mishna (a separate source text).
 * When detected the search is routed to the Mishna document rather than the Gemara.
 */
const MISHNA_KEYWORDS = [
  "מתני'", 'מתניתין', 'מתניתן', 'במשנה', 'משנה'
];

/**
 * Pre-normalized keyword lists (normalizeText applied, sorted longest-first).
 * Built once at module load — never recalculated inside the hot loop.
 */
const _normalizeKw = (kw: string) =>
  kw.replace(/[\u0591-\u05C7]/g, '')           // strip nikud
    .replace(/[׳''´]/g, "'")                   // normalize single-quotes
    .replace(/[״""]/g, '"')                    // normalize double-quotes
    .replace(/[^\u05D0-\u05EA0-9\s'"]+/g, ' ') // keep only Hebrew + digits + quotes
    .replace(/\s+/g, ' ').trim();

const RASHI_KEYWORDS_NORM: string[] = [...new Set(RASHI_KEYWORDS.map(_normalizeKw))]
  .sort((a, b) => b.length - a.length);   // longest first → no short prefix steals match

const TOSAFOT_KEYWORDS_NORM: string[] = [...new Set(TOSAFOT_KEYWORDS.map(_normalizeKw))]
  .sort((a, b) => b.length - a.length);

const GEMARA_KEYWORDS_NORM: string[] = [...new Set(GEMARA_KEYWORDS.map(_normalizeKw))]
  .sort((a, b) => b.length - a.length);

const MISHNA_KEYWORDS_NORM: string[] = [...new Set(MISHNA_KEYWORDS.map(_normalizeKw))]
  .sort((a, b) => b.length - a.length);

/**
 * Regex that strips a leading "source context" word (גמרא/גמ'/משנה/מתני' etc.)
 * from the start of a commentary line before checking for secondary-source keywords.
 *
 * Use-case: "בגמרא תוספות ד"ה אמרי" → strip "בגמרא" → "תוספות ד"ה אמרי" → route to Tosafot.
 *           "משנה רש"י ד"ה אמרי" → strip "משנה" → "רש"י ד"ה אמרי" → route to Rashi.
 *           "גמ' ..." (no secondary keyword after) → keep original, route to primary source.
 */
const SOURCE_CONTEXT_STRIP_RE = /^(?:בגמרא|גמרא|גמ'|במשנה|משנה|מתניתין|מתניתן|מתני')\s*[:.\-]?\s*/i;

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
    .replace(/[׳'’‘´]{2}/g, '"') // Map consecutive single quotes to double quotes
    .replace(/[׳'’‘´]/g, "'") // Normalize single quotes
    .replace(/[״"“”″‟„]/g, '"'); // Normalize double quotes
}

export function stripSecondaryPrefix(line: string): string {
  if (!line) return '';
  // Step 1: normalize quotes and remove HTML + nikud before regex matching (fixes BUG-37)
  let cleaned = normalizeHebrewQuotes(stripHtmlTags(line.trim()));
  cleaned = cleaned.replace(/[\u0591-\u05C7]/g, '');

  // Step 1.5: strip leading numbers/bullets/brackets and source context prefixes
  cleaned = cleaned.replace(/^(?:\d+[\.\)]|[ א-ת][\.\)]|\([^)]+\)|\[[^\]]+\]|[•\-\*])\s*/, '');
  cleaned = cleaned.replace(/^(?:בגמרא|גמרא|גמ'|במשנה|משנה|מתניתין|מתניתן|מתני')\s*[:.\-]?\s*/i, '');

  // Step 2: strip the secondary-source prefix.
  // Uses dynamically built regex from RASHI_KEYWORDS and TOSAFOT_KEYWORDS
  cleaned = cleaned.replace(SECONDARY_PREFIX_STRIP_RE, '');

  // Step 3: strip a bare ד"ה / דה that may remain after removing only the source name
  // e.g. line was "תוס' ד"ה אמרי" — "תוס'" stripped, "ד"ה" still leads
  cleaned = cleaned.replace(/^ד"ה\s*[:.\-]?\s*/i, '');
  cleaned = cleaned.replace(/^דה\s+/i, '');

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
  const cleanLine = stripHtmlTags(line);
  const normLine = normalizeText(cleanLine, true);
  if (!normLine) return { dhText: '', cleanDh: '', isExplicitDelimiter: false };

  let dhPart = '';
  let explicit = false;

  // 1. If custom delimiter defined, non-empty, and present in line
  if (delimiter && delimiter.trim() && cleanLine.includes(delimiter.trim())) {
    const trimmedDelim = delimiter.trim();
    const idx = cleanLine.indexOf(trimmedDelim);
    dhPart = cleanLine.substring(0, idx);
    explicit = true;
  }
  // 2. Check for כו' / וכו' / וגו' / וגומר / וכולי
  else if (/(?:^|\s)(?:ו?כו'|וגו'|וגומר|וכולי)(?:\s|$|[.,:;])/i.test(cleanLine)) {
    dhPart = cleanLine;
    explicit = true;
  }
  // 3. Fallback when no delimiter configured: do NOT truncate automatically on '.' or ':'
  else {
    dhPart = cleanLine;
    explicit = false;
  }

  // Limit DH to a maximum of 12 words to avoid over-matching on long commentary lines
  const MAX_DH_WORDS = 12;
  const dhWords = dhPart.trim().split(/\s+/).filter(Boolean);
  if (dhWords.length > MAX_DH_WORDS) {
    dhPart = dhWords.slice(0, MAX_DH_WORDS).join(' ');
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

  const enableWordWeighting = config.useWordWeighting !== false;
  const srcIdfMap = enableWordWeighting ? calculateDocumentIdfWeights(srcDoc.lines, commDoc.lines) : undefined;
  const rashiIdfMap = (enableWordWeighting && rashiDoc) ? calculateDocumentIdfWeights(rashiDoc.lines, commDoc.lines) : undefined;
  const tosafotIdfMap = (enableWordWeighting && tosafotDoc) ? calculateDocumentIdfWeights(tosafotDoc.lines, commDoc.lines) : undefined;

  console.log(`  📄 commDoc.segments=${commDoc.segments.length}, srcDoc.segments=${srcDoc.segments.length}, rashiDoc=${rashiDoc ? rashiDoc.segments.length : 'null'}, tosafotDoc=${tosafotDoc ? tosafotDoc.segments.length : 'null'}`);

  const links: OtzariaLink[] = [];
  const dhHighlights: Record<number, DHHighlight> = {};

  // Map source header segments to commentary header segments
  let previousSecondaryType: 'rashi' | 'tosafot' | null = null;

  commDoc.segments.forEach(commSeg => {
    let previousLink: OtzariaLink | null = null;

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

      // Check routing to secondary sources (Step 4).
      // First, strip leading numbers/bullets/brackets and source-context prefixes (גמרא / גמ' / משנה / מתני' etc.)
      let cleanedPrefix = normalizedPrefixLine.replace(/^(?:\d+[\.\)]|[ א-ת][\.\)]|\([^)]+\)|\[[^\]]+\]|[•\-\*])\s*/, '').trim();
      const strippedContextLine = cleanedPrefix.replace(SOURCE_CONTEXT_STRIP_RE, '').trim();
      // Use the stripped version for keyword detection; fall back to full line if stripping
      // left the line empty (meaning the whole line was just "גמ'" with no secondary keyword).
      const lineForKeywordCheck = strippedContextLine || cleanedPrefix || normalizedPrefixLine;

      let targetSecondary: 'rashi' | 'tosafot' | null = null;
      let explicitSecondaryTarget = false;

      if (RASHI_KEYWORDS_NORM.some(kw => lineForKeywordCheck.startsWith(kw))) {
        targetSecondary = 'rashi';
        explicitSecondaryTarget = true;
        console.log(`  ✅ Detected Rashi keyword. normalizedPrefixLine='${normalizedPrefixLine}'`);
      } else if (TOSAFOT_KEYWORDS_NORM.some(kw => lineForKeywordCheck.startsWith(kw))) {
        targetSecondary = 'tosafot';
        explicitSecondaryTarget = true;
        console.log(`  ✅ Detected Tosafot keyword. normalizedPrefixLine='${normalizedPrefixLine}'`);
      } else {
        const inheritTargetRegex = /^(?:שם\s+)?(?:או"ד|באו"ד|א"ד|בא"ד|אד|באד|אוד|באוד|בד"ה|בדה|ד"ה|דה)(?:\s|$|[:.\-])/i;
        if (normalizedPrefixLine.match(inheritTargetRegex) || trimmedLine.startsWith('שם')) {
          targetSecondary = previousSecondaryType;
          if (targetSecondary) explicitSecondaryTarget = true;
        }
      }

      const isBaadRegex = /^(?:שם\s+)?(?:או"ד|באו"ד|א"ד|בא"ד|אד|באד|אוד|באוד)(?:\s|$|[:.\-])/i;
      const isBaad = Boolean(normalizedPrefixLine.match(isBaadRegex));
      const isJustSham = trimmedLine.startsWith('שם') && !normalizedPrefixLine.match(/^שם\s+(?:ד"ה|דה|בד"ה|בדה)(?:\s|$|[:.\-])/i);

      // Bug #6 FIX (per request): a line that opens with an explicit reference — to the primary
      // source (גמ'/גמרא/משנה/מתני'), to a secondary source (רש"י/תוספות keywords), or to a
      // dibur hamatchil (ד"ה/בד"ה) — must never receive inheritance. Such a line is making its own
      // explicit claim about what it's quoting/where it belongs; if that claim's own search fails,
      // it should be reported as unlinked rather than silently backfilled with an unrelated line's
      // source. (Lines starting with 'שם' are a different, deliberate inheritance instruction and
      // are unaffected — see isJustSham/isBaad above.)
      const startsWithSourceRef = SOURCE_CONTEXT_STRIP_RE.test(cleanedPrefix);
      const startsWithSecondaryRef = RASHI_KEYWORDS_NORM.some(kw => lineForKeywordCheck.startsWith(kw))
        || TOSAFOT_KEYWORDS_NORM.some(kw => lineForKeywordCheck.startsWith(kw));
      const startsWithDh = /^(?:בד"ה|בדה|ד"ה|דה)(?:\s|$|[:.\-])/i.test(normalizedPrefixLine);
      const isExplicitlyRoutedLine = startsWithSourceRef || startsWithSecondaryRef || startsWithDh;

      // Handle Inheritance ("שם" - Step 5)
      const shouldInheritLine = isBaad || isJustSham;
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

      // First Anchor Priority search for primary sources containing כו' / וכו'.
      const searchPrimaryWithFirstAnchor = (
        docLines: string[],
        start: number,
        end: number,
        fullLineText: string,
        idfMap?: Record<string, number>,
        prevLineNum?: number | null,
        requireStartAtFirstWord: boolean = false
      ): { lineNum: number | null; matchedCount: number; matchedWordCount: number; expectedWeight: number; topK: {lineNum: number; score: number}[] } => {
        if (!docLines || docLines.length === 0) {
          return { lineNum: null, matchedCount: 0, matchedWordCount: 0, expectedWeight: 0, topK: [] };
        }

        const validStart = Math.max(1, Math.min(start, docLines.length));
        const validEnd = Math.max(validStart, Math.min(end, docLines.length));

        const segments = fullLineText.split(/(?:^|\s)ו?כו'(?:\s|$|[.,:;])/i).map(s => s.trim()).filter(Boolean);
        if (segments.length <= 1) {
          const cleanDh = normalizeText(fullLineText);
          return searchLineInDoc(docLines, validStart, validEnd, cleanDh, fullLineText, true, idfMap, prevLineNum, requireStartAtFirstWord);
        }

        const seg1 = segments[0];
        const seg2 = segments[1];
        const seg3 = segments[2];

        const seg1Words = normalizeText(seg1).split(/\s+/).filter(Boolean);
        const seg2Words = seg2 ? normalizeText(seg2).split(/\s+/).filter(Boolean) : [];
        const seg3Words = seg3 ? normalizeText(seg3).split(/\s+/).filter(Boolean) : [];

        const abbrDict = config.customAbbreviations || DEFAULT_ABBREVIATIONS;
        const enableFuzzy = config.useFuzzyMatching !== false;

        const seg1ExpectedWeight = seg1Words.reduce((sum, w) => sum + getCombinedWordWeight(w, enableWordWeighting, idfMap), 0);
        const fullWords = normalizeText(fullLineText).split(/\s+/).filter(Boolean);
        const expectedWeight = fullWords.reduce((sum, w) => sum + getCombinedWordWeight(w, enableWordWeighting, idfMap), 0);

        let bestLine: number | null = null;
        let maxScore = -Infinity;
        let bestMatchedCount = 0;

        // Bug #3 FIX: Require the matched words of a segment to appear as a CONTIGUOUS run
        // in the target line (like calcContiguousScore does for the main search), instead of
        // scoring each word independently against the whole line ("bag of words"). A bag-of-words
        // score can be inflated by words that are scattered anywhere in the line in any order,
        // which both creates false positives on wrong lines and doesn't reflect the fact that a
        // quoted phrase should read as a real consecutive sequence in the source.
        const calcSegmentContiguousScore = (segWords: string[], targetWords: string[]): number => {
          if (segWords.length === 0 || targetWords.length === 0) return 0;
          let maxSeqScore = 0;
          for (let docWIdx = 0; docWIdx < targetWords.length; docWIdx++) {
            let k = 0;
            let seqScore = 0;
            while (k < segWords.length && docWIdx + k < targetWords.length) {
              const sim = getWordSimilarity(segWords[k], targetWords[docWIdx + k], enableFuzzy);
              if (sim <= 0) break;
              const wWeight = getCombinedWordWeight(segWords[k], enableWordWeighting, idfMap);
              seqScore += sim * wWeight;
              k++;
            }
            if (seqScore > maxSeqScore) maxSeqScore = seqScore;
          }
          return maxSeqScore;
        };

        const scoreSegment = (segWords: string[], docLineNorm: string, docWords: string[]): number => {
          if (segWords.length === 0) return 0;
          const segPhrase = segWords.join(' ');
          if (docLineNorm.includes(segPhrase)) {
            return segWords.reduce((sum, w) => sum + getCombinedWordWeight(w, enableWordWeighting, idfMap) * 1.5, 5);
          }
          return calcSegmentContiguousScore(segWords, docWords);
        };

        // Bug #4 FIX: expand ראשי תיבות (abbreviations) contextually for EVERY segment, not just
        // the first one. A DH like "...כו' ק"ו..." needs "ק"ו" expanded to "קל וחומר" to match the
        // spelled-out source text, exactly as we already did for the anchor segment.
        const scoreSegmentWithAbbrev = (segText: string, segWordsRaw: string[], targetLineNorm: string, targetWords: string[]): number => {
          if (segWordsRaw.length === 0) return 0;
          const plainScore = scoreSegment(segWordsRaw, targetLineNorm, targetWords);
          if (config.useAbbreviationExpansion === false) return plainScore;
          const expSeg = expandAbbreviationsInText(segText, targetLineNorm, abbrDict);
          const expSegWords = normalizeText(expSeg).split(/\s+/).filter(Boolean);
          if (expSegWords.length === 0 || expSegWords.join(' ') === segWordsRaw.join(' ')) return plainScore;
          const expScore = scoreSegment(expSegWords, targetLineNorm, targetWords);
          return Math.max(plainScore, expScore);
        };

        for (let lNum = validStart; lNum <= validEnd; lNum++) {
          const docLineRaw = docLines[lNum - 1];
          if (!docLineRaw) continue;
          const docLineNorm = normalizeText(docLineRaw);
          if (!docLineNorm) continue;
          const docWords = docLineNorm.split(/\s+/).filter(Boolean);
          if (docWords.length === 0) continue;

          const score1 = scoreSegmentWithAbbrev(seg1, seg1Words, docLineNorm, docWords);

          const minSeg1Threshold = Math.max(0.4, seg1ExpectedWeight * 0.4);
          if (score1 < minSeg1Threshold) continue;

          let seqScore = score1 * 2.5; // Anchor Weight bonus for First Anchor
          let foundSeq2 = !seg2Words.length;
          let foundSeq3 = !seg3Words.length;

          if (seg2Words.length > 0) {
            let bestSeg2Score = 0;
            for (let nextL = lNum; nextL <= Math.min(docLines.length, lNum + 10); nextL++) {
              const nextRaw = docLines[nextL - 1];
              if (!nextRaw) continue;
              const nextNorm = normalizeText(nextRaw);
              const nextWords = nextNorm.split(/\s+/).filter(Boolean);
              const s2 = scoreSegmentWithAbbrev(seg2, seg2Words, nextNorm, nextWords);
              if (s2 > bestSeg2Score) {
                bestSeg2Score = s2;
                if (s2 >= 0.4) foundSeq2 = true;
              }
            }
            seqScore += bestSeg2Score * 1.2;
          }

          if (seg3Words.length > 0 && foundSeq2) {
            let bestSeg3Score = 0;
            for (let nextL = lNum; nextL <= Math.min(docLines.length, lNum + 15); nextL++) {
              const nextRaw = docLines[nextL - 1];
              if (!nextRaw) continue;
              const nextNorm = normalizeText(nextRaw);
              const nextWords = nextNorm.split(/\s+/).filter(Boolean);
              const s3 = scoreSegmentWithAbbrev(seg3, seg3Words, nextNorm, nextWords);
              if (s3 > bestSeg3Score) {
                bestSeg3Score = s3;
                if (s3 >= 0.4) foundSeq3 = true;
              }
            }
            seqScore += bestSeg3Score * 1.0;
          }

          let distPenalty = 0;
          if (prevLineNum !== null && prevLineNum !== undefined && prevLineNum > 0) {
            const diff = lNum - prevLineNum;
            if (diff < 0) {
              distPenalty = Math.abs(diff) * 0.08;
            } else if (diff > 5) {
              distPenalty = (diff - 5) * 0.03;
            }
          }

          const finalCandidateScore = seqScore - distPenalty;

          if (finalCandidateScore > maxScore) {
            maxScore = finalCandidateScore;
            bestLine = lNum;
            bestMatchedCount = score1;
          }
        }

        if (bestLine !== null) {
          return { lineNum: bestLine, matchedCount: bestMatchedCount, matchedWordCount: seg1Words.length, expectedWeight, topK: [{ lineNum: bestLine, score: bestMatchedCount }] };
        }

        const cleanDh = normalizeText(fullLineText);
        return searchLineInDoc(docLines, validStart, validEnd, cleanDh, fullLineText, true, idfMap, prevLineNum, requireStartAtFirstWord);
      };

      // Primary search function: matches phrase or finds longest contiguous matching prefix from commentary line
      const searchLineInDoc = (
        docLines: string[],
        start: number,
        end: number,
        searchPhrase: string,
        fullLineText: string,
        isExplicit: boolean,
        idfMap?: Record<string, number>,
        prevLineNum?: number | null,
        requireStartAtFirstWord: boolean = false
      ): { lineNum: number | null; matchedCount: number; matchedWordCount: number; expectedWeight: number; topK: {lineNum: number; score: number}[] } => {
        if (!docLines || docLines.length === 0) {
          console.log(`    ⚠️ searchLineInDoc: docLines is empty!`);
          return { lineNum: null, matchedCount: 0, matchedWordCount: 0, expectedWeight: 0, topK: [] };
        }

        const validStart = Math.max(1, Math.min(start, docLines.length));
        const validEnd = Math.max(validStart, Math.min(end, docLines.length));

        const searchWords = searchPhrase.split(/\s+/).filter(Boolean);
        const fullWords = normalizeText(fullLineText).split(/\s+/).filter(Boolean);
        const abbrDict = config.customAbbreviations || DEFAULT_ABBREVIATIONS;

        const wordsForWeight = isExplicit ? searchWords : fullWords;
        const expectedWeight = wordsForWeight.reduce(
          (sum, w) => sum + getCombinedWordWeight(w, enableWordWeighting, idfMap),
          0
        );

        console.log(`    📊 searchLineInDoc: validStart=${validStart}, validEnd=${validEnd}, prevLineNum=${prevLineNum ?? 'none'}, searchWords=[${searchWords.join(',')}], fullWords=[${fullWords.join(',')}], isExplicit=${isExplicit}, expectedWeight=${expectedWeight.toFixed(2)}, requireStartAtFirstWord=${requireStartAtFirstWord}`);

        const searchRanges = [
          { s: validStart, e: validEnd }
        ];

        for (const range of searchRanges) {
          let bestLine: number | null = null;
          let maxMatchedCount = 0;
          let bestMatchedWordCount = 0;
          let minDistance = Infinity;
          let linesChecked = 0;

          // Nikud fingerprint of the search phrase (commentary side — usually empty since
          // commentary text has no nikud, but kept for completeness).
          // The fingerprint of each SOURCE candidate is computed on demand below and used
          // as a tie-breaker when two candidates have identical match scores.
          const searchFp = fullLineText.split(/\s+/).filter(Boolean)
            .map(w => getNikudFingerprint(w)).join('');
          let bestLineFpDist = Infinity; // fingerprint distance of current bestLine

          // Top-K collection: keeps the best 3 candidates sorted by score descending.
          // Each entry: { lineNum, score, fpDist, dist }
          const TOP_K = 3;
          const topCandidates: { lineNum: number; score: number; dist: number; fpDist: number }[] = [];

          for (let lNum = range.s; lNum <= range.e; lNum++) {
            const docLineRaw = docLines[lNum - 1];
            if (!docLineRaw) continue;
            const docLineNorm = normalizeText(docLineRaw);
            if (!docLineNorm) continue;

            linesChecked++;
            const docWords = docLineNorm.split(/\s+/).filter(Boolean);
            if (docWords.length === 0) continue;

            // Expand Rashei Teivot (abbreviations) for candidate target line
            const expSearchPhrase = config.useAbbreviationExpansion !== false
              ? expandAbbreviationsInText(searchPhrase, docLineNorm, abbrDict)
              : searchPhrase;
            const expFullLineText = config.useAbbreviationExpansion !== false
              ? expandAbbreviationsInText(fullLineText, docLineNorm, abbrDict)
              : fullLineText;
            const expDocLineNorm = config.useAbbreviationExpansion !== false
              ? expandAbbreviationsInText(docLineNorm, fullLineText, abbrDict)
              : docLineNorm;

            const expSearchWords = normalizeText(expSearchPhrase).split(/\s+/).filter(Boolean);
            const expFullWords = normalizeText(expFullLineText).split(/\s+/).filter(Boolean);
            const expDocWords = normalizeText(expDocLineNorm).split(/\s+/).filter(Boolean);

            const enableFuzzy = config.useFuzzyMatching !== false;
            let currentMatchCount = 0;
            let currentWordCount = 0;

            const calcContiguousScore = (sourceWords: string[], targetWords: string[]): { score: number; wordCount: number } => {
              // Only consider starting positions within the first 3 words of the commentary line
              const maxStartIdx = Math.min(3, sourceWords.length);
              // Cap source to 12 words maximum
              const MAX_DH_WORDS = 12;
              const cappedSource = sourceWords.slice(0, MAX_DH_WORDS);
              let maxSeqScore = 0;
              let bestWordCount = 0;
              for (let startWIdx = 0; startWIdx < maxStartIdx; startWIdx++) {
                const maxDocWIdx = requireStartAtFirstWord ? 1 : targetWords.length;
                for (let docWIdx = 0; docWIdx < maxDocWIdx; docWIdx++) {
                  let k = 0;
                  let seqScore = 0;
                  while (
                    startWIdx + k < cappedSource.length &&
                    docWIdx + k < targetWords.length
                  ) {
                    const w1 = cappedSource[startWIdx + k];
                    const w2 = targetWords[docWIdx + k];
                    const sim = getWordSimilarity(w1, w2, enableFuzzy);
                    if (sim <= 0) break;
                    const wWeight = getCombinedWordWeight(w1, enableWordWeighting, idfMap);
                    seqScore += sim * wWeight;
                    k++;
                  }
                  if (seqScore > maxSeqScore) {
                    maxSeqScore = seqScore;
                    bestWordCount = k;
                  }
                }
              }
              return { score: maxSeqScore, wordCount: bestWordCount };
            };

            if (isExplicit) {
              // Explicit delimiter / כו': search for searchPhrase or expSearchPhrase in docLineNorm / expDocLineNorm
              const matchAtStart = requireStartAtFirstWord
                ? (docLineNorm.indexOf(searchPhrase) === 0 || expDocLineNorm.indexOf(expSearchPhrase) === 0)
                : (docLineNorm.includes(searchPhrase) || expDocLineNorm.includes(expSearchPhrase));

              if (matchAtStart) {
                // Perfect exact substring match gets maximum bonus based on expectedWeight
                currentMatchCount = expectedWeight + 10;
                currentWordCount = searchWords.length;
              } else {
                // Word-by-word matching with fuzzy similarity score and word weighting
                const combos = [
                  calcContiguousScore(searchWords, docWords),
                  calcContiguousScore(expSearchWords, expDocWords),
                  calcContiguousScore(searchWords, expDocWords),
                  calcContiguousScore(expSearchWords, docWords),
                ];
                const winningRes = combos.reduce((best, c) => c.score > best.score ? c : best);
                currentMatchCount = winningRes.score;
                currentWordCount = winningRes.wordCount;
              }
            } else {
              // No explicit delimiter: find longest contiguous sequence of matching words.
              // Constraint: the sequence must start within the first 3 words of the commentary
              // line to avoid false positives from incidental word matches deep in the line.
              // Also caps sourceWords to MAX_DH_WORDS (12) to bound the search space.
              const combos = [
                calcContiguousScore(fullWords, docWords),
                calcContiguousScore(expFullWords, expDocWords),
                calcContiguousScore(fullWords, expDocWords),
                calcContiguousScore(expFullWords, docWords),
              ];
              const winningRes = combos.reduce((best, c) => c.score > best.score ? c : best);
              let rawMatchCount = winningRes.score;
              currentWordCount = winningRes.wordCount;

              // Apply Sequential Monotonicity Penalty if prevLineNum is available
              // Note: Very subtle bias (max 5% - 7%) so that out-of-order commentaries are not penalized
              let distPenalty = 1.0;
              if (prevLineNum !== null && prevLineNum !== undefined && prevLineNum > 0) {
                const diff = lNum - prevLineNum;
                if (diff < 0) {
                  // Gentle micro-preference for current/subsequent lines over backward jumps (max 7% drop)
                  distPenalty = Math.max(0.93, 1.0 - Math.abs(diff) * 0.005);
                } else if (diff > 5) {
                  // Gentle micro-preference for closer lines over far forward jumps (max 5% drop)
                  distPenalty = Math.max(0.95, 1.0 - (diff - 5) * 0.002);
                }
              }

              currentMatchCount = rawMatchCount * distPenalty;
            }

          const minThreshold = isExplicit 
            ? Math.min(1.5, Math.max(0.7, expectedWeight * 0.65))
            : Math.min(1.5, Math.max(0.7, expectedWeight * 0.65));

            if (currentMatchCount >= minThreshold) {
              const dist = Math.abs(lNum - range.s);

              // Nikud fingerprint tie-breaker:
              // When the source line carries nikud, compute a fingerprint and compare
              // it to the search phrase fingerprint. A closer vowel pattern wins ties.
              const candidateFp = docLines[lNum - 1]
                ? docLines[lNum - 1].split(/\s+/).filter(Boolean)
                    .map(w => getNikudFingerprint(w)).join('')
                : '';
              const fpDist = searchFp.length > 0 && candidateFp.length > 0
                ? levenshteinDistance(searchFp, candidateFp)
                : Infinity;

              if (currentMatchCount > maxMatchedCount) {
                maxMatchedCount = currentMatchCount;
                bestMatchedWordCount = currentWordCount;
                bestLine = lNum;
                minDistance = dist;
                bestLineFpDist = fpDist;
              } else if (currentMatchCount === maxMatchedCount) {
                // Primary tie-break: closer position
                if (dist < minDistance) {
                  bestLine = lNum;
                  bestMatchedWordCount = currentWordCount;
                  minDistance = dist;
                  bestLineFpDist = fpDist;
                } else if (dist === minDistance && fpDist < bestLineFpDist) {
                  // Secondary tie-break: better nikud fingerprint match
                  bestLine = lNum;
                  bestMatchedWordCount = currentWordCount;
                  bestLineFpDist = fpDist;
                }
              }

              // ── Top-K collection ──────────────────────────────────────────────
              // Insert into topCandidates maintaining sorted order (best score first).
              // Ties broken by dist then fpDist, same as bestLine logic above.
              const insertIdx = topCandidates.findIndex(c =>
                currentMatchCount > c.score ||
                (currentMatchCount === c.score && dist < c.dist) ||
                (currentMatchCount === c.score && dist === c.dist && fpDist < c.fpDist)
              );
              if (insertIdx !== -1) {
                topCandidates.splice(insertIdx, 0, { lineNum: lNum, score: currentMatchCount, dist, fpDist });
              } else if (topCandidates.length < TOP_K) {
                topCandidates.push({ lineNum: lNum, score: currentMatchCount, dist, fpDist });
              }
              // Keep only TOP_K entries
              if (topCandidates.length > TOP_K) topCandidates.length = TOP_K;
            }
          }

          console.log(`    ✓ searchLineInDoc checked ${linesChecked} lines, bestLine=${bestLine}, maxMatchedCount=${maxMatchedCount}`);
          if (bestLine !== null) {
            return { lineNum: bestLine, matchedCount: maxMatchedCount, matchedWordCount: bestMatchedWordCount, expectedWeight, topK: topCandidates.map(c => ({ lineNum: c.lineNum, score: c.score })) };
          }
        }

        return { lineNum: null, matchedCount: 0, matchedWordCount: 0, expectedWeight: 0, topK: [] };
      };

      let srcMatchRes = { lineNum: null as number | null, matchedCount: 0, matchedWordCount: 0, expectedWeight: 0, topK: [] as {lineNum: number; score: number}[] };
      let secMatchRes = { lineNum: null as number | null, matchedCount: 0, matchedWordCount: 0, expectedWeight: 0, topK: [] as {lineNum: number; score: number}[] };

      // Bug #1 FIX: Calculate separate "previous line index" for secondary sources.
      // We only want to use the previous line of the SAME secondary document (e.g. Rashi vs Rashi).
      const prevSecondaryLineNum = (previousLink && previousLink.secondaryTarget === targetSecondary)
        ? (previousLink.secondary_line_index || null)
        : null;

      // Bug #2 FIX: DH quotes containing כו' (e.g. "עד סוף כו' ומשם ואילך עבר זמנו כו' ומקמי הכי")
      // are multi-segment quotes with omitted words in between. The plain contiguous matcher
      // in searchLineInDoc breaks as soon as it hits the literal "כו'" token, so these almost
      // always failed to match when routed to a secondary source (Rashi/Tosafot), even though
      // the same DH pattern was already handled correctly for the primary source below via
      // searchPrimaryWithFirstAnchor. We now apply the identical First-Anchor segment search
      // to Rashi/Tosafot as well, so 'כו'-לינק'ing works consistently for every source book.
      const hasKooSecondary = /(?:^|\s)ו?כו'(?:\s|$|[.,:;])/i.test(lineForDhExtraction) || /(?:^|\s)ו?כו'(?:\s|$|[.,:;])/i.test(trimmedLine);

      // Search in secondary source if routed (unless it's 'בא"ד', in which case we don't search, we inherit)
      if (!shouldInheritLine && targetSecondary === 'rashi' && rashiDoc) {
        console.log(`🔍 Searching for Rashi: keyword='${normalizedPrefixLine}', cleanDh='${cleanDh}', lineForDhExtraction='${lineForDhExtraction}'`);
        if (hasKooSecondary) {
          console.log(`  🎯 Applying First Anchor Priority for Rashi with כו' / וכו'`);
          secMatchRes = searchPrimaryWithFirstAnchor(
            rashiDoc.lines,
            rashiSeg ? rashiSeg.startLine : 1,
            rashiSeg ? rashiSeg.endLine : rashiDoc.lines.length,
            lineForDhExtraction,
            rashiIdfMap,
            prevSecondaryLineNum,
            true
          );
        } else {
          secMatchRes = searchLineInDoc(
            rashiDoc.lines,
            rashiSeg ? rashiSeg.startLine : 1,
            rashiSeg ? rashiSeg.endLine : rashiDoc.lines.length,
            cleanDh,
            lineForDhExtraction,
            isExplicitDelimiter,
            rashiIdfMap,
            prevSecondaryLineNum,
            true
          );
        }
        console.log(`  → Rashi search result: lineNum=${secMatchRes.lineNum}, matchedCount=${secMatchRes.matchedCount}`);
        matchedSecondaryLineNum = secMatchRes.lineNum;
      } else if (!shouldInheritLine && targetSecondary === 'tosafot' && tosafotDoc) {
        console.log(`🔍 Searching for Tosafot: keyword='${normalizedPrefixLine}', cleanDh='${cleanDh}', lineForDhExtraction='${lineForDhExtraction}'`);
        if (hasKooSecondary) {
          console.log(`  🎯 Applying First Anchor Priority for Tosafot with כו' / וכו'`);
          secMatchRes = searchPrimaryWithFirstAnchor(
            tosafotDoc.lines,
            tosafotSeg ? tosafotSeg.startLine : 1,
            tosafotSeg ? tosafotSeg.endLine : tosafotDoc.lines.length,
            lineForDhExtraction,
            tosafotIdfMap,
            prevSecondaryLineNum,
            true
          );
        } else {
          secMatchRes = searchLineInDoc(
            tosafotDoc.lines,
            tosafotSeg ? tosafotSeg.startLine : 1,
            tosafotSeg ? tosafotSeg.endLine : tosafotDoc.lines.length,
            cleanDh,
            lineForDhExtraction,
            isExplicitDelimiter,
            tosafotIdfMap,
            prevSecondaryLineNum,
            true
          );
        }
        console.log(`  → Tosafot search result: lineNum=${secMatchRes.lineNum}, matchedCount=${secMatchRes.matchedCount}`);
        matchedSecondaryLineNum = secMatchRes.lineNum;
      }

      // Search in primary source segment unless the line explicitly targets a secondary source or is 'בא"ד' (which means inherit previous).
      if (!explicitSecondaryTarget && !shouldInheritLine) {
        // Bug #1 (Part 2) FIX: Ensure we only use the last PRIMARY source line for distance hint.
        // If previousLink was Rashi/Tosafot, line_index_2 is NOT a primary source index.
        const prevPrimaryLineNum = (previousLink && !previousLink.secondaryTarget)
          ? previousLink.line_index_2
          : (lastMatchedSrcLineIndex || null);

        console.log(`🔍 Searching PRIMARY source: lineForDhExtraction='${lineForDhExtraction}', cleanDh='${cleanDh}', isExplicit=${isExplicitDelimiter}`);
        const hasKoo = /(?:^|\s)ו?כו'(?:\s|$|[.,:;])/i.test(lineForDhExtraction) || /(?:^|\s)ו?כו'(?:\s|$|[.,:;])/i.test(trimmedLine);
        if (hasKoo) {
          console.log(`  🎯 Applying First Anchor Priority for primary source with כו' / וכו'`);
          srcMatchRes = searchPrimaryWithFirstAnchor(
            srcDoc.lines,
            srcSeg ? srcSeg.startLine : 1,
            srcSeg ? srcSeg.endLine : srcDoc.lines.length,
            lineForDhExtraction,
            srcIdfMap,
            prevPrimaryLineNum
          );
        } else {
          srcMatchRes = searchLineInDoc(
            srcDoc.lines,
            srcSeg ? srcSeg.startLine : 1,
            srcSeg ? srcSeg.endLine : srcDoc.lines.length,
            cleanDh,
            lineForDhExtraction,
            isExplicitDelimiter,
            srcIdfMap,
            prevPrimaryLineNum,
            false
          );
        }
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
        let mappedPrimaryLine = (previousLink && !previousLink.secondaryTarget ? previousLink.line_index_2 : null)
          || lastMatchedSrcLineIndex 
          || (srcSeg ? srcSeg.startLine : 1);
        
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
      if (shouldInheritLine) {
        if (!config.ignoreShamInShas || !matchedSourceLineNum) {
          if (previousLink) {
            matchedSourceLineNum = previousLink.line_index_2;
            matchedSecondaryLineNum = previousLink.secondary_line_index || null;
            targetSecondary = previousLink.secondaryTarget || null;
            isInherited = true;
          }
        }
      }

      // Bug #5 FIX (per request): previously, if no direct match was found for this line, the code
      // silently fell back to inheriting the previous line's source/context, marking isInherited=true.
      // This masked genuine "no source found" cases behind a (likely wrong) inherited link instead of
      // surfacing them as unlinked. A line that fails to match on its own must now be reported as
      // unlinked ("ללא מקור מקושר") rather than silently inheriting the previous line's link.
      // (Explicit "שם"/"בא"ד" inheritance above is unaffected — that's a deliberate instruction in the
      // text itself, not a failure fallback.)

      // Fallback inheritance: if no direct match was found for this line, silently inherit the
      // previous line's source/context. Only applies when this is not an explicit secondary citation.
      // NOTE: this is intentionally limited the same way explicit "שם" inheritance is limited above —
      // see the `else` branch further below, which resets previousLink to null whenever a line ends up
      // with NO link at all (not even via this fallback). That way, if line 5 fails to find a direct
      // match AND has no previousLink to inherit from (so this fallback itself can't fire), line 6
      // will NOT reach past line 5 to inherit from line 4 — the "no source" state propagates forward
      // instead of being silently skipped.
      if (!matchedSourceLineNum && !explicitSecondaryTarget && !isExplicitlyRoutedLine && previousLink && previousLink.line_index_2) {
        matchedSourceLineNum = previousLink.line_index_2;
        matchedSecondaryLineNum = previousLink.secondary_line_index || null;
        targetSecondary = previousLink.secondaryTarget || null;
        isInherited = true;
      }

      // If we got a source line match, create OtzariaLink
      if (matchedSourceLineNum) {
        // Bug #2 FIX: Only update the last matched PRIMARY source index if the match was actually in the primary source.
        if (!targetSecondary) {
          lastMatchedSrcLineIndex = matchedSourceLineNum;
        }
        
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

        const matchScore = Math.max(srcMatchRes.matchedCount, secMatchRes.matchedCount);
        const expWeight = Math.max(srcMatchRes.expectedWeight, secMatchRes.expectedWeight);
        const wordLength = (cleanDh || lineForDhExtraction).split(/\s+/).filter(Boolean).length;
        const confidence = calculateLinkConfidence(Boolean(isInherited), matchScore, wordLength, isExplicitDelimiter, expWeight);
        const status: 'approved' | 'pending' = confidence >= 85 ? 'approved' : 'pending';

        // Build Top-K candidates list from whichever source produced the match.
        // Each candidate gets its own confidence score so the UI can show it.
        const rawTopK = explicitSecondaryTarget
          ? secMatchRes.topK
          : srcMatchRes.topK.length > 0
            ? srcMatchRes.topK
            : secMatchRes.topK;

        const linkCandidates: import('../types').LinkCandidate[] = rawTopK.map(c => ({
          lineNum: c.lineNum,
          score: c.score,
          confidence: calculateLinkConfidence(false, c.score, wordLength, isExplicitDelimiter, expWeight)
        }));

        const targetDocLines = isSecondaryLink
          ? (targetSecondary === 'rashi' ? rashiDoc?.lines : tosafotDoc?.lines)
          : srcDoc.lines;
        const targetLineText = targetDocLines && targetDocLines[matchedSourceLineNum - 1] ? targetDocLines[matchedSourceLineNum - 1] : '';
        const matchRange = findSourceMatchRange(targetLineText, dhText || cleanDh) || undefined;

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
          dhText: dhText || cleanDh,
          confidence,
          status,
          matchRange,
          candidates: linkCandidates.length > 0 ? linkCandidates : undefined,
          candidateIndex: 0
        };

        links.push(newLink);
        previousLink = newLink;
        previousSecondaryType = targetSecondary;
      } else {
        // Bug #5 FIX (clarified): a line that found NO link at all — not even via inheritance —
        // must also clear previousLink for the NEXT line. Otherwise a later line that itself
        // needs to inherit (e.g. 'שם'/'בא"ד') would skip over this unlinked line and reach back
        // to the last successfully-linked line, effectively resurrecting the exact silent-inheritance
        // behavior we just removed, just one line later. The "no source found" state must propagate
        // forward until a real match (direct or explicit) is found again.
        previousLink = null;
        previousSecondaryType = null;
      }

      // Calculate initial DH word highlight range (words count)
      const wordsInLine = trimmedLine.split(/\s+/).filter(Boolean);
      let dhWordCount = 0;
      if (isExplicitDelimiter && dhText) {
        dhWordCount = dhText.split(/\s+/).filter(Boolean).length;
      } else {
        dhWordCount = srcMatchRes.matchedWordCount > 0 
          ? srcMatchRes.matchedWordCount 
          : (secMatchRes.matchedWordCount > 0 ? secMatchRes.matchedWordCount : Math.min(4, wordsInLine.length));
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
export function findSourceMatchRange(sourceLine: string, dhText: string): DHHighlight | null {
  if (!sourceLine || !dhText) return null;
  const targetWords = normalizeText(stripHtmlTags(sourceLine)).split(/\s+/).filter(Boolean);
  const sourceWords = normalizeText(stripHtmlTags(dhText)).split(/\s+/).filter(Boolean);
  if (targetWords.length === 0 || sourceWords.length === 0) return null;

  const matchedIndices: number[] = [];

  for (let srcIdx = 0; srcIdx < sourceWords.length; srcIdx++) {
    const w1 = sourceWords[srcIdx];
    let bestTgtIdx = -1;
    let bestSim = 0;

    for (let tgtIdx = 0; tgtIdx < targetWords.length; tgtIdx++) {
      const w2 = targetWords[tgtIdx];
      
      // 1. Direct similarity match
      let sim = getWordSimilarity(w1, w2, true);

      // 2. Abbreviation map match
      if (sim <= 0.4) {
        const options1 = NORMALIZED_ABBREVIATIONS_MAP[w1];
        if (options1) {
          for (const opt of options1) {
            if (opt.split(/\s+/).some(optW => getWordSimilarity(optW, w2, true) > 0.6)) {
              sim = 0.8;
              break;
            }
          }
        }
        if (sim <= 0.4) {
          const options2 = NORMALIZED_ABBREVIATIONS_MAP[w2];
          if (options2) {
            for (const opt of options2) {
              if (opt.split(/\s+/).some(optW => getWordSimilarity(optW, w1, true) > 0.6)) {
                sim = 0.8;
                break;
              }
            }
          }
        }
      }

      // 3. Simple character-level prefix/abbreviation heuristic
      if (sim <= 0.4) {
        const clean1 = w1.replace(/['"]/g, '');
        const clean2 = w2.replace(/['"]/g, '');
        if (clean1 && clean2) {
          if (clean1.startsWith(clean2) || clean2.startsWith(clean1)) {
            sim = 0.6;
          }
        }
      }

      if (sim > bestSim) {
        bestSim = sim;
        bestTgtIdx = tgtIdx;
      }
    }

    if (bestSim > 0.4 && bestTgtIdx !== -1) {
      matchedIndices.push(bestTgtIdx);
    }
  }

  if (matchedIndices.length === 0) return null;

  // Sort and find boundaries
  matchedIndices.sort((a, b) => a - b);
  const minIdx = matchedIndices[0];
  const maxIdx = matchedIndices[matchedIndices.length - 1];
  const count = maxIdx - minIdx + 1;

  // Safeguard: If matches are too sparse across a massive line, keep it to the first cluster
  if (count > sourceWords.length + 5 && matchedIndices.length < sourceWords.length / 2) {
    return { wordStart: matchedIndices[0], wordCount: 1 };
  }

  return { wordStart: minIdx, wordCount: count };
}

export function formatLineWithDH(line: string, highlight?: DHHighlight, customId?: string, isSource?: boolean, forExport?: boolean): string {
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

    if (forExport) {
      words[startArrIdx] = '<b>' + words[startArrIdx];
      words[endArrIdx] = words[endArrIdx] + '</b>';
    } else {
      const spanId = customId ? ` id="${customId}"` : '';
      const spanClass = isSource 
        ? ` class="source-match-highlight bg-yellow-200/60 dark:bg-yellow-500/30 border border-gray-400 dark:border-gray-600 rounded px-0.5 mx-0.5"`
        : ` class="dh-highlight font-bold bg-yellow-200/60 dark:bg-yellow-500/30 border border-gray-400 dark:border-gray-600 rounded px-0.5 mx-0.5"`;

      words[startArrIdx] = `<mark${spanId}${spanClass}>` + words[startArrIdx];
      words[endArrIdx] = words[endArrIdx] + '</mark>';
    }

    return words.join('');
  } catch (e) {
    console.error('Error in formatLineWithDH:', e);
    return line;
  }
}
