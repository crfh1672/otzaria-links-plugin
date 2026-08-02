import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

const badBlockRegex = /<div className="flex-1 overflow-y-auto p-4 space-y-2">[\s\S]*$/;

const newBlock = `<div className="flex-1 flex flex-col min-h-0">
              {drawerTab === 'search' ? (
                <div className="p-4 space-y-4">
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={e => setSourceSearchQuery(e.target.value)}
                    placeholder="חיפוש בכל הפרויקט..."
                    className="w-full pl-3 pr-4 py-2 text-sm bg-[var(--color-surface-container-low)] border border-[var(--color-outline)] rounded-xl text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-sans"
                  />
                  <p className="text-xs text-[var(--color-on-surface-variant)]">
                    החיפוש מסנן את הרשימה הראשית לפי שורות פירוש או מקור.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Heading Search */}
                  {commentarySegments.length > 3 && (
                    <div className="p-3 border-b border-[var(--color-outline)] bg-[var(--color-surface-container-low)] shrink-0">
                      <div className="relative">
                        <input
                          type="text"
                          value={drawerSearchQuery}
                          onChange={(e) => setDrawerSearchQuery(e.target.value)}
                          placeholder="סינון/חיפוש בכותרות..."
                          className="w-full pl-3 pr-8 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-lg text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-sans"
                        />
                        <Search className="w-3.5 h-3.5 text-[var(--color-on-surface-variant)] absolute right-2.5 top-2.5" />
                      </div>
                    </div>
                  )}

                  {/* List of extracted Headings */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredDrawerSegments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-low)] rounded-xl border border-dashed border-[var(--color-outline)] font-medium">
                        לא נמצאו כותרות המתאימות לחיפוש
                      </div>
                    ) : (
                      filteredDrawerSegments.map((seg, sIdx) => {
                        const segLinkCount = links.filter(
                          l => l.line_index_1 >= seg.startLine && l.line_index_1 <= seg.endLine
                        ).length;

                        return (
                          <button
                            key={\`drawer-seg-\${sIdx}\`}
                            onClick={() => handleSelectHeading(seg)}
                            className="w-full text-right p-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-primary-subtle)] hover:border-[var(--color-primary)] transition-all group flex flex-col gap-1.5 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Bookmark className="w-4 h-4 text-[var(--color-primary)] shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-xs sm:text-sm text-[var(--color-on-surface)] truncate font-serif">
                                  {seg.headerTitle}
                                </span>
                              </div>
                              {seg.headerLineIndex > 0 && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-outline)] text-[var(--color-on-surface-variant)] shrink-0">
                                  שורה {seg.headerLineIndex}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[var(--color-on-surface-variant)] pt-1.5 border-t border-[var(--color-outline-variant)]/60">
                              <span>שורות {seg.startLine} עד {seg.endLine}</span>
                              <span className="font-bold text-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-0.5 rounded-md border border-[var(--color-outline-variant)]">
                                {segLinkCount} קישורים
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="p-3 border-t border-[var(--color-outline)] bg-[var(--color-surface-container-high)] text-center text-xs text-[var(--color-on-surface-variant)] font-medium shrink-0">
                    לחיצה על כותרת תגלול אוטומטית לקטע המבוקש בדף
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
`;

content = content.replace(badBlockRegex, newBlock);
fs.writeFileSync('src/components/EditMode.tsx', content);
