import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

const badBlock = `              ) : (
                commentarySegments.length === 0 ? (

              <button
                onClick={onCloseNavDrawer}
                className="p-1.5 rounded-xl hover:bg-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] transition-colors cursor-pointer"
                title="סגור סרגל ניווט"
              >
                <X className="w-5 h-5" />
              </button>
            </div>`;

content = content.replace(badBlock, "              ) : (");

const badEnd = `
                  return (
                    <button
                      key={\`drawer-seg-\${sIdx}\`}
                      onClick={() => handleSelectHeading(seg)}
                      className="w-full text-right p-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-primary-subtle)] hover:border-[var(--color-primary)] transition-all group flex flex-col gap-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--color-on-surface)] truncate text-sm">
                          {seg.title}
                        </span>
                        <ChevronLeft className="w-4 h-4 text-[var(--color-on-surface-variant)] group-hover:-translate-x-1 transition-transform" />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[var(--color-on-surface-variant)] font-medium">
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          <span>שורות {seg.startLine}-{seg.endLine}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          <span>{segLinkCount} קישורים</span>
                        </div>
                      </div>
                    </button>
                  );
                })))
              )}`;

const goodEnd = `
                  return (
                    <button
                      key={\`drawer-seg-\${sIdx}\`}
                      onClick={() => handleSelectHeading(seg)}
                      className="w-full text-right p-3 rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-primary-subtle)] hover:border-[var(--color-primary)] transition-all group flex flex-col gap-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--color-on-surface)] truncate text-sm">
                          {seg.title}
                        </span>
                        <ChevronLeft className="w-4 h-4 text-[var(--color-on-surface-variant)] group-hover:-translate-x-1 transition-transform" />
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[var(--color-on-surface-variant)] font-medium">
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          <span>שורות {seg.startLine}-{seg.endLine}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          <span>{segLinkCount} קישורים</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
              {/* End of nav tab */}
              )} 
`;

content = content.replace(badEnd, goodEnd);

fs.writeFileSync('src/components/EditMode.tsx', content);
