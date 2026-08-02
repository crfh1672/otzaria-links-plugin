import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// Remove Secondary Sticky Header
const searchFilterStart = "{/* Search & Filter Header Bar */}";
const searchFilterStartIndex = content.indexOf(searchFilterStart);
const mainListIndex = content.indexOf("{/* Main Unified List */}");

if (searchFilterStartIndex !== -1 && mainListIndex !== -1) {
  content = content.substring(0, searchFilterStartIndex) + content.substring(mainListIndex);
}

// Modify the Drawer Panel to add tabs
const drawerHeaderMatch = /<div className="p-4 border-b border-\[var\(--color-outline\)\] flex items-center justify-between bg-\[var\(--color-surface-container-high\)\]">[\s\S]*?<\/div>\s*<\/div>/;

const newDrawerHeader = `
            {/* Drawer Header */}
            <div className="flex flex-col bg-[var(--color-surface-container-high)]">
              <div className="p-4 border-b border-[var(--color-outline)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xs">
                    <ListTree className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[var(--color-on-surface)]">
                      סרגל ניווט וחיפוש
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onCloseNavDrawer}
                  className="p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)] rounded-lg transition-colors"
                  title="סגור סרגל ניווט"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex items-center border-b border-[var(--color-outline)]">
                <button
                  onClick={() => setDrawerTab('nav')}
                  className={\`flex-1 py-2 text-xs font-bold transition-colors \${
                    drawerTab === 'nav'
                      ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)]'
                  }\`}
                >
                  ניווט
                </button>
                <button
                  onClick={() => setDrawerTab('search')}
                  className={\`flex-1 py-2 text-xs font-bold transition-colors \${
                    drawerTab === 'search'
                      ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary-subtle)]'
                  }\`}
                >
                  חיפוש
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {drawerTab === 'search' ? (
                <div className="space-y-4">
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
                commentarySegments.length === 0 ? (
`;

content = content.replace(drawerHeaderMatch, newDrawerHeader);

// Now fix the end of the drawer content because we wrapped `commentarySegments.length === 0 ? ...` inside `{drawerTab === 'search' ? ... : (`
const drawerEndMatch = /<\/button>\s*<\/div>\s*\)\s*\}\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/;

content = content.replace(
  /<\/div>\s*<\/div>\s*<\/div>\s*\)\}/,
  "              )} \n            </div>\n          </div>\n        </div>\n      )}"
);

// We should properly balance the parentheses. Let's just use string replacement for the exact end of the loop:
content = content.replace(
  "                )))\n              )}",
  "                )))\n              )}\n              {/* End of nav tab */}\n              )} "
);


fs.writeFileSync('src/components/EditMode.tsx', content);
