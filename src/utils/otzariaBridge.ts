import { BookNode } from '../types';
import { MOCK_BOOK_CONTENTS, MOCK_LIBRARY_TREE } from '../data/otzariaLibraryMock';

declare global {
  interface Window {
    Otzaria?: {
      call: (method: string, payload?: any) => Promise<{ success: boolean; data?: any; error?: any }>;
      on: (event: string, callback: (payload: any) => void) => void;
      off: (event: string, callback: (payload: any) => void) => void;
    };
  }
}

export const isOtzariaAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.Otzaria !== 'undefined' && typeof window.Otzaria.call === 'function';
};

export async function fetchLibraryTree(): Promise<BookNode> {
  if (isOtzariaAvailable()) {
    try {
      const res = await window.Otzaria!.call('library.getTree', { includeBooks: true });
      if (res && res.success && res.data) {
        return res.data;
      }
    } catch (e) {
      console.warn('Otzaria getTree failed, fallback to mock tree', e);
    }
  }
  return MOCK_LIBRARY_TREE;
}

export async function fetchBookContent(bookId: string): Promise<string> {
  if (isOtzariaAvailable()) {
    try {
      // Otzaria content limit is 5000 per request or stream
      let fullContent = '';
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await window.Otzaria!.call('library.getBookContent', {
          bookId,
          offset,
          limit: 5000
        });
        if (res && res.success && typeof res.data === 'string') {
          if (!res.data || res.data.length === 0) {
            hasMore = false;
          } else {
            fullContent += res.data;
            offset += res.data.length;
            if (res.data.length < 5000) hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      if (fullContent.trim()) return fullContent;
    } catch (e) {
      console.warn(`Otzaria getBookContent failed for ${bookId}, fallback to mock`, e);
    }
  }

  // Fallback / local mock match
  if (MOCK_BOOK_CONTENTS[bookId]) {
    return MOCK_BOOK_CONTENTS[bookId];
  }

  // Partial match search in mock contents
  const foundKey = Object.keys(MOCK_BOOK_CONTENTS).find(k => k.includes(bookId) || bookId.includes(k));
  if (foundKey) return MOCK_BOOK_CONTENTS[foundKey];

  return `<h1>${bookId}</h1>\nלא נמצא תוכן עבור ספר זה בספרייה. אנא יבא קובץ טקסט חיצוני או בחר ספר תואם.`;
}

export async function saveToCache(key: string, value: any): Promise<void> {
  if (isOtzariaAvailable()) {
    try {
      await window.Otzaria!.call('storage.set', { key, value });
      return;
    } catch (e) {
      console.warn('Otzaria storage.set failed, using localStorage', e);
    }
  }
  localStorage.setItem(`otzaria_link_gen_${key}`, JSON.stringify(value));
}

export async function getFromCache<T = any>(key: string): Promise<T | null> {
  if (isOtzariaAvailable()) {
    try {
      const res = await window.Otzaria!.call('storage.get', { key });
      if (res && res.success) return res.data as T;
    } catch (e) {
      console.warn('Otzaria storage.get failed, using localStorage', e);
    }
  }
  const raw = localStorage.getItem(`otzaria_link_gen_${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function removeFromCache(key: string): Promise<void> {
  if (isOtzariaAvailable()) {
    try {
      await window.Otzaria!.call('storage.remove', { key });
      return;
    } catch (e) {
      console.warn('Otzaria storage.remove failed, using localStorage', e);
    }
  }
  localStorage.removeItem(`otzaria_link_gen_${key}`);
}

export async function listCacheKeys(): Promise<string[]> {
  if (isOtzariaAvailable()) {
    try {
      const res = await window.Otzaria!.call('storage.list');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (e) {
      console.warn('Otzaria storage.list failed, using localStorage', e);
    }
  }
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('otzaria_link_gen_')) {
      keys.push(k.replace('otzaria_link_gen_', ''));
    }
  }
  return keys;
}

export async function notifySuccess(message: string): Promise<void> {
  if (isOtzariaAvailable()) {
    try {
      await window.Otzaria!.call('ui.showSuccess', { message });
      return;
    } catch {}
  }
}

export async function notifyError(message: string): Promise<void> {
  if (isOtzariaAvailable()) {
    try {
      await window.Otzaria!.call('ui.showError', { message });
      return;
    } catch {}
  }
}
