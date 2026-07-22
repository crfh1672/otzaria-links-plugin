import React, { useState, useEffect, useMemo } from 'react';
import { BookNode, PluginConfig, TANAKH_BOOKS, SHAS_TRACTATES } from '../types';
import { fetchLibraryTree, fetchBookContent, notifyError } from '../utils/otzariaBridge';
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
    tosafotText?: string
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
  const [delimiter, setDelimiter] = useState<string>('.');

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

      // In Shas mode, fetch secondary source files (Rashi and Tosafot for tractate)
      if (category === 'shas') {
        try {
          rashiText = await fetchBookContent(`רש"י על ${targetBook}`);
        } catch {
          rashiText = undefined;
        }
        try {
          tosafotText = await fetchBookContent(`תוספות על ${targetBook}`);
        } catch {
          tosafotText = undefined;
        }
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
        tosafotText
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
    const hasBooks = node.books && node.books.length > 0;

    // Filter books based on search query
    const filteredBooks = useMemo(() => {
      if (!node.books) return [];
      if (!searchQuery.trim()) return node.books;
      const q = searchQuery.toLowerCase();
      return node.books.filter(b => b.title.toLowerCase().includes(q) || b.bookId.toLowerCase().includes(q));
    }, [node.books, searchQuery]);

    if (!hasCategories && filteredBooks.length === 0 && searchQuery.trim()) {
      return null;
    }

    return (
      <div key={node.path} className="mr-2 my-0.5">
        {node.path !== '/' && (
          <button
            onClick={() => toggleExpand(node.path)}
            className="flex items-center gap-1.5 w-full text-right py-1 px-2 hover:bg-slate-200/60 dark:hover:bg-slate-700/50 rounded-md text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{node.title}</span>
          </button>
        )}

        {(isExpanded || node.path === '/') && (
          <div className="mr-3 border-r border-slate-300/60 dark:border-slate-700/60 pr-1 py-0.5 space-y-0.5">
            {node.categories?.map(child => renderTreeNode(child))}
            {filteredBooks.map(book => (
              <button
                key={book.bookId}
                onClick={() => handleSelectBookFromTree(book.bookId, book.title)}
                className={`flex items-center gap-2 w-full text-right py-1.2 px-2.5 rounded-md text-xs font-medium transition-all ${
                  selectedBookTitle === book.title
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
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
        
        {/* Right Pane: Book Browser (6 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[620px] overflow-hidden">
          {/* Top Bar of Right Pane */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חיפוש מהיר בספרים..."
                  className="w-full pr-8 pl-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg transition-colors border border-slate-300/80 dark:border-slate-600">
                <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300/50"
                  title="חזור לעץ הספרים"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>חזרה לעץ</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Pane Body: Tree or Preview */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50">
            {selectedBookTitle ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {selectedBookTitle}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {commentaryContent.split(/\r?\n/).length} שורות נטענו
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>

                <div className="bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono leading-relaxed text-slate-700 dark:text-slate-300 max-h-[460px] overflow-y-auto whitespace-pre-wrap">
                  {loadingBookContent ? (
                    <div className="py-12 text-center text-slate-400">טוען תוכן ספר...</div>
                  ) : (
                    commentaryContent.slice(0, 3000) + (commentaryContent.length > 3000 ? '\n\n...[המשך הספר נטען במלואו בעת הריצה]...' : '')
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
                  עץ הספרים באוצריא
                </h3>
                {loadingTree ? (
                  <div className="py-12 text-center text-slate-400 text-xs">טוען את עץ הספרייה...</div>
                ) : tree ? (
                  renderTreeNode(tree)
                ) : (
                  <div className="text-xs text-slate-500 p-4">לא ניתן לטעון את עץ הספרים</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Left Pane: Configuration & Settings (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[620px] overflow-hidden">
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              אפיון והגדרות מיפוי
            </h3>
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-6">
            {/* Source Category Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                קטגוריית מקור:
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCategory('tanakh')}
                  className={`py-2 px-3 text-xs font-bold rounded-md transition-all ${
                    category === 'tanakh'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  תנ"ך
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('shas')}
                  className={`py-2 px-3 text-xs font-bold rounded-md transition-all ${
                    category === 'shas'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  ש"ס (תלמוד בבלי)
                </button>
              </div>
            </div>

            {/* Target Book Dropdown */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                בחירת ספר המטרה המקושר:
              </label>
              <select
                value={targetBook}
                onChange={e => setTargetBook(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {(category === 'tanakh' ? TANAKH_BOOKS : SHAS_TRACTATES).map(book => (
                  <option key={book} value={book}>
                    {book}
                  </option>
                ))}
              </select>
            </div>

            {/* Commentary Characterization Options */}
            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                איפיון ספר הפרשנות
              </h4>

              {/* Toggle for 'שם' in Shas */}
              {category === 'shas' && (
                <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80">
                  <div className="space-y-0.5">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      האם המילה 'שם' משמשת כהפניה לדף בגמרא?
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      במקום ירושת קישור ישיר מהשורה הקודמת
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIgnoreShamInShas(!ignoreShamInShas)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      ignoreShamInShas ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        ignoreShamInShas ? '-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Dibur Hamatchil Delimiter */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  תו סיום דיבור המתחיל (ד"ה):
                </label>
                <input
                  type="text"
                  value={delimiter}
                  onChange={e => setDelimiter(e.target.value)}
                  placeholder="לדוגמה: . או .:"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  המחרוזת מתחילת השורה עד לתו זה תיחשב כדיבור המתחיל
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Left Run Button */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {selectedBookTitle ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition-all"
            >
              {isProcessing ? (
                <span>מעבד מיפוי...</span>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
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
