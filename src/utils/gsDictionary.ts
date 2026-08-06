export interface GsDictionary {
  abbreviations?: Record<string, string[]>;
  replacements?: Record<string, string[]>;
}

function normalizeDictionary(raw: any): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const dict: Record<string, string[]> = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!key || typeof key !== 'string') return;
    if (Array.isArray(value)) {
      const options = value.map(item => String(item).trim()).filter(Boolean);
      if (options.length > 0) dict[key] = options;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) dict[key] = [trimmed];
    }
  });

  return Object.keys(dict).length > 0 ? dict : undefined;
}

// Two formats are accepted, both from the embedded <script> tag and from
// a fetched gs-dictionary.json (for normal http/https deployments):
// 1) Wrapped:  { "abbreviations": { "key": [...] , ... }, "replacements": { ... } }
// 2) Flat:     { "key1": [...], "key2": [...], ... }  <-- same shape as
//    DEFAULT_ABBREVIATIONS and the dictionary exported from the modal.
function parseGsDictionaryPayload(data: unknown): GsDictionary | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const raw = data as Record<string, unknown>;
  const hasWrapper = 'abbreviations' in raw || 'replacements' in raw;

  const abbreviations = hasWrapper
    ? normalizeDictionary(raw.abbreviations)
    : normalizeDictionary(raw);
  const replacements = hasWrapper
    ? normalizeDictionary(raw.replacements)
    : undefined;

  if (!abbreviations && !replacements) return null;

  return { abbreviations, replacements };
}

const EMBEDDED_ELEMENT_ID = 'gs-dictionary-data';

/**
 * Reads the dictionary from an inert <script type="application/json" id="gs-dictionary-data">
 * tag embedded directly in the packaged single-file HTML by scripts/pack-plugin.js.
 *
 * This is the primary path when the plugin runs as a standalone HTML file opened
 * from disk (file://): the browser never executes or parses this tag as code, so
 * there is effectively zero cost until we explicitly JSON.parse() it here — and,
 * critically, it sidesteps the fetch() CORS restriction that blocks file:// reads
 * entirely (fetching a local file from a null/file origin is disallowed by the
 * browser regardless of what the code does).
 */
function readEmbeddedDictionary(): GsDictionary | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(EMBEDDED_ELEMENT_ID);
  if (!el || !el.textContent) return null;

  try {
    const data = JSON.parse(el.textContent);
    return parseGsDictionaryPayload(data);
  } catch (err) {
    console.warn('Failed to parse embedded GS dictionary:', err);
    return null;
  }
}

/**
 * Fallback path for normal http/https deployments (not the packaged single-file
 * plugin), where a real network fetch of a static gs-dictionary.json works fine.
 */
async function fetchGsDictionary(): Promise<GsDictionary | null> {
  try {
    const res = await fetch('gs-dictionary.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return parseGsDictionaryPayload(data);
  } catch (err) {
    console.warn('Failed to load GS dictionary:', err);
    return null;
  }
}

export async function loadGsDictionary(): Promise<GsDictionary | null> {
  const embedded = readEmbeddedDictionary();
  if (embedded) return embedded;

  // Only try the network as a fallback — under file:// this will always fail
  // fast (and silently, via the try/catch in fetchGsDictionary), so it's safe
  // to attempt without hurting startup time.
  return fetchGsDictionary();
}
