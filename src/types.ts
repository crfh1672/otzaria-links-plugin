/**
 * Types & Interfaces according to Otzaria Links Generator Plugin SRS
 */

export interface OtzariaLink {
  line_index_1: number;       // 1-based physical line index of commentary
  line_index_2: number;       // 1-based physical line index of target source
  heRef_2: string;            // Hebrew reference (e.g. "בראשית א, א")
  path_2: string;             // Target source filename in system (e.g. "בראשית.txt")
  connection_type: "commentary";
  
  // UI and internal routing state
  secondaryTarget?: 'rashi' | 'tosafot';
  secondary_line_index?: number;
  secondaryRef?: string;
  isInherited?: boolean;      // True if context was inherited (purple background)
  dhText?: string;            // Extracted Dibur Hamatchil
  confidence?: number;        // Confidence level score (0 - 100%)
  status?: 'approved' | 'pending'; // Approval state for link review
}

export interface PluginConfig {
  sourceCategory: 'tanakh' | 'shas';
  targetBookName: string;
  ignoreShamInShas: boolean;      // "האם המילה 'שם' משמשת כהפניה לדף בגמרא?"
  diburHamatchilDelimiter?: string; // "תו סיום דיבור המתחיל" (e.g. '.' or '.:')
  useAbbreviationExpansion?: boolean; // "תמיכה בפענוח ראשי תיבות"
  customAbbreviations?: Record<string, string[]>; // מילון ראשי תיבות מותאם אישית
  useFuzzyMatching?: boolean; // "השוואה גמישה קלה (Fuzzy Matching)"
}

export interface DHHighlight {
  wordStart: number;
  wordCount: number;
}

export interface SessionState {
  id: string;
  commentaryFileName: string;
  commentaryTitle: string;
  config: PluginConfig;
  links: OtzariaLink[];
  commentaryLines: string[];      // Physical raw text lines (\n preserved)
  sourceLines: string[];          // Primary source physical lines
  rashiLines?: string[];          // Secondary Rashi lines (if Shas)
  tosafotLines?: string[];        // Secondary Tosafot lines (if Shas)
  dhHighlights?: Record<number, DHHighlight>; // line_index_1 -> word highlights
  lastModifiedTimestamp: number;
}

export interface BookNode {
  title: string;
  path: string;
  categories?: BookNode[];
  books?: {
    bookId: string;
    title: string;
    type?: string;
    author?: string;
    topics?: string;
  }[];
}

export const TANAKH_BOOKS = [
  "בראשית", "שמות", "ויקרא", "במדבר", "דברים",
  "יהושע", "שופטים", "שמואל א", "שמואל ב", "מלכים א", "מלכים ב",
  "ישעיהו", "ירמיהו", "יחזקאל",
  "הושע", "יואל", "עמוס", "עובדיה", "יונה", "מיכה", "נחום", "חבקוק", "צפניה", "חגי", "זכריה", "מלאכי"
];

export const SHAS_TRACTATES = [
  "ברכות", "שבת", "עירובין", "פסחים", "ראש השנה", "יומא", "סוכה", "ביצה", "תענית", "מגילה", "מועד קטן", "חגיגה",
  "יבמות", "כתובות", "נדרים", "נזיר", "סוטה", "גיטין", "קידושין",
  "בבא קמא", "בבא מציעא", "בבא בתרא", "סנהדרין", "מכות", "שבועות", "עבודה זרה", "הוריות",
  "זבחים", "מנחות", "חולין", "בכורות", "ערכין", "תמורה", "כריתות", "מעילה", "תמיד", "נדה"
];
