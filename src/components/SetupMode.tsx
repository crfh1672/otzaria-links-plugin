import React, { useState, useEffect, useMemo } from 'react';
import { BookNode, PluginConfig, TANAKH_BOOKS, SHAS_TRACTATES } from '../types';
import { fetchLibraryTree, fetchBookContent, fetchBookLinks, notifyError } from '../utils/otzariaBridge';
import {
  Search,
  Upload,
  BookOpen,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Play,
  FileText,
  Settings2,
  CheckCircle2
} from 'lucide-react';

interface SetupModeProps {
  onRunAlgorithm: (
    commentaryText: string,
    commentaryTitle: string,
    config: PluginConfig,
    sourceText: string,
    rashiText?: string,
    tosafotText?: string,
    rashiLinks?: any[],
    tosafotLinks?: any[]
  ) => void;
}

export const SetupMode: React.FC<SetupModeProps> = ({ onRunAlgorithm }) => {
  // Tree & Selected Book State
  const [tree, setTree] = useState<BookNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded Commentary State
  const [selectedBookTitle, setSelectedBookTitle] = useState<string | null>(null);
  const [commentaryContent, setCommentaryContent] = useState<string>('');
  const [loadingBookContent, setLoadingContent] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({
    '/תנך': true,
    '/שס': true
  });

  // Config State
  const [category, setCategory] = useState<'tanakh' | 'shas'>('tanakh');
  const [targetBook, setTargetBook] = useState<string>(TANAKH_BOOKS[0]);
  const [ignoreShamInShas, setIgnoreShamInShas] = useState<boolean>(false);
  const [delimiter, setDelimiter] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);

  // Update default target book when category changes
  useEffect(() => {
    if (category === 'tanakh') {
      if (!TANAKH_BOOKS.includes(targetBook)) {
        setTargetBook(TANAKH_BOOKS[0]);
      }
    } else {
      if (!SHAS_TRACTATES.includes(targetBook)) {
        setTargetBook(SHAS_TRACTATES[0]);
      }
    }
  }, [category]);

  const getSecondaryBookVariants = (targetBook: string, source: 'rashi' | 'tosafot') => {
    const base = targetBook.replace(/^מסכת\s+/i, '').trim();
    if (source === 'rashi') {
      return [
        `רש"י על ${targetBook}`,
        `רש"י על ${base}`,
        `רש"י ${targetBook}`,
        `רש"י ${base}`,
        `רש"י על מסכת ${base}`,
        `רש"י על ספר ${base}`
      ];
    }
    return [
      `תוספות על ${targetBook}`,
      `תוספות על ${base}`,
      `תוס' על ${targetBook}`,
      `תוס' על ${base}`,
      `תוס על ${targetBook}`,
      `תוס על ${base}`,
      `תוסות על ${targetBook}`,
      `תוסות על ${base}`,
      `תוספות על מסכת ${base}`,
      `תוס' על מסכת ${base}`
    ];
  };

  const tryFetchSecondarySource = async (
    variants: string[]
  ): Promise<{ text?: string; links: any[] }> => {
    for (const candidate of variants) {
      const raw = await fetchBookContent(candidate);
      if (raw && !raw.includes('לא נמצא תוכן עבור ספר זה')) {
        const candidateLinks = await fetchBookLinks(candidate);
        return { text: raw, links: candidateLinks || [] };
      }
    }
    return { links: [] };
  };

  // Load Library Tree on mount
  useEffect(() => {
    let isMounted = true;
    fetchLibraryTree().then(treeData => {
      if (isMounted) {
        setTree(treeData);
        setLoadingTree(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const handleSelectBookFromTree = async (bookId: string, title: string) => {
    setSelectedBookTitle(title);
    setLoadingContent(true);
    try {
      const content = await fetchBookContent(bookId);
      setCommentaryContent(content);
    } catch (e) {
      console.error(e);
      notifyError('שגיאה שטעינת תוכן הספר');
    } finally {
      setLoadingContent(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const title = file.name.replace(/\.[^/.]+$/, '');
        setSelectedBookTitle(title);
        setCommentaryContent(text);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleRun = async () => {
    if (!selectedBookTitle || !commentaryContent.trim()) {
      notifyError('אנא בחר ספר פירוש או טען קובץ טקסט');
      return;
    }

    setIsProcessing(true);
    try {
      // Fetch primary target source book
      const sourceText = await fetchBookContent(targetBook);

      let rashiText: string | undefined = undefined;
      let tosafotText: string | undefined = undefined;
      let rashiLinks: any[] = [];
      let tosafotLinks: any[] = [];

      // Fetch secondary source files (Rashi and Tosafot for target book if available)
      try {
        const rashiVariants = getSecondaryBookVariants(targetBook, 'rashi');
        const rashiResult = await tryFetchSecondarySource(rashiVariants);
        if (rashiResult.text) {
          rashiText = rashiResult.text;
          rashiLinks = rashiResult.links;
        }
      } catch {
        rashiText = undefined;
      }

      try {
        const tosafotVariants = getSecondaryBookVariants(targetBook, 'tosafot');
        const tosafotResult = await tryFetchSecondarySource(tosafotVariants);
        if (tosafotResult.text) {
          tosafotText = tosafotResult.text;
          tosafotLinks = tosafotResult.links;
        }
      } catch {
        tosafotText = undefined;
      }

      const config: PluginConfig = {
        sourceCategory: category,
        targetBookName: targetBook,
        ignoreShamInShas,
        diburHamatchilDelimiter: delimiter
      };

      onRunAlgorithm(
        commentaryContent,
        selectedBookTitle,
        config,
        sourceText,
        rashiText,
        tosafotText,
        rashiLinks,
        tosafotLinks
      );
    } catch (err) {
      console.error(err);
      notifyError('שגיאה בריצת אלגוריתם המיפוי');
    } finally {
      setIsProcessing(false);
    }
  };

  // Render recursive category tree
  const renderTreeNode = (node: BookNode) => {
    const isExpanded = expandedPaths[node.path];
    const hasCategories = node.categories && node.categories.length > 0;

    // Filter books based on search query without hooks inside recursive calls
    const q = searchQuery.toLowerCase().trim();
    const filteredBooks = (!node.books)
      ? []
      : (!q)
      ? node.books
      : node.books.filter(b => b.title.toLowerCase().includes(q) || b.bookId.toLowerCase().includes(q));

    if (!hasCategories && filteredBooks.length === 0 && q) {
      return null;
    }

    return (
      <div key={node.path} className="mr-2 my-0.5">
        {node.path !== '/' && (
          <button
            onClick={() => toggleExpand(node.path)}
            className="flex items-center gap-2 w-full text-right py-1.5 px-2 hover:bg-[var(--color-secondary-subtle)] rounded-lg text-sm font-semibold text-[var(--color-on-surface)] transition-colors"
          >
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4 text-[var(--color-on-surface-variant)] shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--color-on-surface-variant)] shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4.5 h-4.5 text-current shrink-0" />
            ) : (
              <Folder className="w-4.5 h-4.5 text-current shrink-0" />
            )}
            <span className="truncate">{node.title}</span>
          </button>
        )}

        {(isExpanded || node.path === '/') && (
          <div className="mr-3 border-r border-[var(--color-outline)] pr-1.5 py-0.5 space-y-0.5">
            {node.categories?.map(child => renderTreeNode(child))}
            {filteredBooks.map(book => (
              <button
                key={book.bookId}
                onClick={() => handleSelectBookFromTree(book.bookId, book.title)}
                className={`flex items-center gap-2 w-full text-right py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                  selectedBookTitle === book.title
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xs font-bold'
                    : 'hover:bg-[var(--color-secondary-subtle)] text-[var(--color-on-surface)]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-80" />
                <span className="truncate">{book.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Right Pane: Book Browser (7 Cols) */}
        <div className="lg:col-span-7 bg-[var(--color-surface)] text-[var(--color-on-surface)] rounded-2xl shadow-xs border border-[var(--color-outline-variant)] flex flex-col h-[620px] overflow-hidden">
          {/* Top Bar of Right Pane */}
          <div className="p-3.5 bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline)] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[var(--color-on-surface-variant)] absolute right-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חיפוש מהיר בספרים..."
                  className="w-full pr-8 pl-3 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-on-surface)]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--color-secondary-subtle)] hover:bg-[var(--color-outline-variant)] text-[var(--color-on-surface)] rounded-lg transition-colors border border-[var(--color-outline)]">
                <Upload className="w-3.5 h-3.5 text-current" />
                <span>ייבוא TXT חיצוני</span>
                <input
                  type="file"
                  accept=".txt,.text"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {selectedBookTitle && (
                <button
                  onClick={() => {
                    setSelectedBookTitle(null);
                    setCommentaryContent('');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] hover:opacity-90 rounded-lg transition-colors border border-[var(--color-outline)]"
                  title="חזור לעץ הספרים"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>חזרה לעץ</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Pane Body: Tree or Preview */}
          <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-surface-container-low)]">
            {selectedBookTitle ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[var(--color-primary-subtle)] p-3 rounded-xl border border-[var(--color-outline)]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[var(--color-on-surface)]" />
                    <div>
                      <h4 className="text-sm font-bold text-[var(--color-on-surface)]">
                        {selectedBookTitle}
                      </h4>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">
                        {commentaryContent.split(/\r?\n/).length} שורות נטענו
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-[var(--color-on-surface)]" />
                </div>

                <div className="bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-outline)] text-xs font-serif leading-relaxed text-[var(--color-on-surface)] max-h-[460px] overflow-y-auto whitespace-pre-wrap">
                  {loadingBookContent ? (
                    <div className="py-12 text-center text-[var(--color-on-surface-variant)]">טוען תוכן ספר...</div>
                  ) : (
                    commentaryContent.slice(0, 3000) + (commentaryContent.length > 3000 ? '\n\n...[המשך הספר נטען במלואו בעת הריצה]...' : '')
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-on-surface-variant)] mb-3 px-1">
                  עץ הספרים באוצריא
                </h3>
                {loadingTree ? (
                  <div className="py-12 text-center text-[var(--color-on-surface-variant)] text-xs">טוען את עץ הספרייה...</div>
                ) : tree ? (
                  renderTreeNode(tree)
                ) : (
                  <div className="text-xs text-[var(--color-on-surface-variant)] p-4">לא ניתן לטעון את עץ הספרים</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Left Pane: Configuration & Settings (5 Cols) */}
        <div className="lg:col-span-5 bg-[var(--color-surface)] text-[var(--color-on-surface)] rounded-2xl shadow-xs border border-[var(--color-outline-variant)] flex flex-col h-[620px] overflow-hidden">
          <div className="p-3.5 bg-[var(--color-surface-container-high)] border-b border-[var(--color-outline)] flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[var(--color-on-surface)]" />
            <h3 className="text-sm font-bold text-[var(--color-on-surface)]">
              אפיון והגדרות מיפוי
            </h3>
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            {/* Source Category Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-on-surface)]">
                קטגוריית מקור:
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[var(--color-surface-container-high)] p-1 rounded-xl border border-[var(--color-outline)]">
                <button
                  type="button"
                  onClick={() => setCategory('tanakh')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    category === 'tanakh'
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-2xs'
                      : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
                  }`}
                >
                  תנ"ך
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('shas')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    category === 'shas'
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-2xs'
                      : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
                  }`}
                >
                  ש"ס (תלמוד בבלי)
                </button>
              </div>
            </div>

            {/* Target Book Dropdown */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-on-surface)]">
                בחירת ספר המטרה המקושר:
              </label>
              <select
                value={targetBook}
                onChange={e => setTargetBook(e.target.value)}
                className="w-full p-2.5 text-xs bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-medium"
              >
                {(category === 'tanakh' ? TANAKH_BOOKS : SHAS_TRACTATES).map(book => (
                  <option key={book} value={book}>
                    {book}
                  </option>
                ))}
              </select>
            </div>

            {/* Commentary Characterization Options */}
            <div className="space-y-4 pt-3 border-t border-[var(--color-outline)]">
              <h4 className="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                איפיון ספר הפרשנות
              </h4>

              {/* Toggle for 'שם' in Shas */}
              {category === 'shas' && (
                <div className="flex items-center justify-between gap-3 p-3 bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-outline)]">
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold text-[var(--color-on-surface)]">
                      האם המילה 'שם' משמשת כהפניה לדף בגמרא?
                    </span>
                    <span className="block text-[11px] text-[var(--color-on-surface-variant)]">
                      במקום ירושת קישור ישיר מהשורה הקודמת
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIgnoreShamInShas(!ignoreShamInShas)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      ignoreShamInShas ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-outline)]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        ignoreShamInShas ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Dibur Hamatchil Delimiter */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--color-on-surface)]">
                  תו סיום דיבור המתחיל (ד"ה) [רשות]:
                </label>
                <input
                  type="text"
                  value={delimiter}
                  onChange={e => setDelimiter(e.target.value)}
                  placeholder="לדוגמה: . או - (השאר ריק לזיהוי אוטומטי לפי התאמה ארוכה)"
                  className="w-full p-2.5 text-xs bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="text-[11px] text-[var(--color-on-surface-variant)]">
                  אם לא יוגדר תו סיום, האלגוריתם יזהה אוטומטית את ההתאמה הארוכה ביותר של תחילת המשפט במקור.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Left Run Button */}
          <div className="p-4 bg-[var(--color-surface-container-high)] border-t border-[var(--color-outline)] shrink-0 flex items-center justify-between">
            <div className="text-xs text-[var(--color-on-surface-variant)]">
              {selectedBookTitle ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  ✓ מוכן להרצת האלגוריתם
                </span>
              ) : (
                'בחר ספר פירוש מימין כדי להתחיל'
              )}
            </div>

            <button
              type="button"
              onClick={handleRun}
              disabled={!selectedBookTitle || isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 active:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all"
            >
              {isProcessing ? (
                <span>מעבד מיפוי...</span>
              ) : (
                <>
                  <Play className="w-4 h-4 text-current" />
                  <span>הפעל אלגוריתם מיפוי</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
