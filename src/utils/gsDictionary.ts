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

export async function loadGsDictionary(): Promise<GsDictionary | null> {
  try {
    const res = await fetch('gs-dictionary.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

    // The file placed in the app folder can be in one of two formats:
    // 1) Wrapped:  { "abbreviations": { "א\"א": [...] , ... }, "replacements": { ... } }
    // 2) Flat:     { "א\"א": [...], "א\"ב": [...], ... }  <-- same shape as
    //    DEFAULT_ABBREVIATIONS and the dictionary exported from the modal.
    // Previously only format (1) was accepted, so a plain flat dictionary
    // (like the one exported via "ייצוא JSON" or maintained externally)
    // silently failed to load. We now detect and support both.
    const raw = data as Record<string, unknown>;
    const hasWrapper = 'abbreviations' in raw || 'replacements' in raw;

    const abbreviations = hasWrapper
      ? normalizeDictionary(raw.abbreviations)
      : normalizeDictionary(raw);
    const replacements = hasWrapper
      ? normalizeDictionary(raw.replacements)
      : undefined;

    if (!abbreviations && !replacements) return null;

    return {
      abbreviations,
      replacements,
    };
  } catch (err) {
    console.warn('Failed to load GS dictionary:', err);
    return null;
  }
}

