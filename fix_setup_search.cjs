const fs = require('fs');
let code = fs.readFileSync('src/components/SetupMode.tsx', 'utf8');

// Add flatten function
const helperFunc = `
  const getFlatBooksMatchingSearch = (node: BookNode, query: string): Array<{bookId: string, title: string, path: string}> => {
    let results: Array<{bookId: string, title: string, path: string}> = [];
    const q = query.toLowerCase().trim();
    if (node.books) {
      for (const b of node.books) {
        if (b.title.toLowerCase().includes(q) || b.bookId.toLowerCase().includes(q)) {
          results.push({ bookId: b.bookId, title: b.title, path: node.title === 'ספריית אוצריא' ? '' : node.title });
        }
      }
    }
    if (node.categories) {
      for (const child of node.categories) {
        results = results.concat(getFlatBooksMatchingSearch(child, query));
      }
    }
    return results;
  };
`;

code = code.replace(
  "const doesNodeMatchSearch = (node: BookNode): boolean => {",
  helperFunc + "\n  const doesNodeMatchSearch = (node: BookNode): boolean => {"
);

// Replace render call
const newRender = `
                {loadingTree ? (
                  <div className="py-12 text-center text-[var(--color-on-surface-variant)] text-xs">טוען את עץ הספרייה...</div>
                ) : tree ? (
                  searchQuery.trim() ? (
                    <div className="space-y-1">
                      {getFlatBooksMatchingSearch(tree, searchQuery).map(book => (
                        <button
                          key={book.bookId}
                          onClick={() => handleSelectBookFromTree(book.bookId, book.title)}
                          className={\`flex items-center gap-2 w-full text-right py-2 px-3 rounded-lg text-sm font-medium transition-all \${
                            selectedBookTitle === book.title
                              ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold'
                              : 'hover:bg-[var(--color-secondary-subtle)] text-[var(--color-on-surface)]'
                          }\`}
                        >
                          <BookOpen className="w-4 h-4 shrink-0 opacity-80" />
                          <div className="flex flex-col items-start truncate">
                            <span className="truncate">{book.title}</span>
                            {book.path && <span className="text-[10px] text-[var(--color-on-surface-variant)] truncate">{book.path}</span>}
                          </div>
                        </button>
                      ))}
                      {getFlatBooksMatchingSearch(tree, searchQuery).length === 0 && (
                        <div className="text-center text-xs text-[var(--color-on-surface-variant)] py-4">לא נמצאו ספרים התואמים לחיפוש</div>
                      )}
                    </div>
                  ) : (
                    renderTreeNode(tree)
                  )
                ) : (
`;

code = code.replace(
  /\{loadingTree \? \([\s\S]*?renderTreeNode\(tree\)[\s\S]*?\) : \(/,
  newRender
);

fs.writeFileSync('src/components/SetupMode.tsx', code);
