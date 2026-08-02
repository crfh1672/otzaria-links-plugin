import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Add sort state
content = content.replace(
  "  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);",
  "  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);\n  const [sortMode, setSortMode] = useState<'book_order' | 'score_asc' | 'score_desc'>('book_order');"
);

// Pass to TopToolbar
content = content.replace(
  "onToggleNavDrawer={() => setIsNavDrawerOpen(prev => !prev)}",
  "onToggleNavDrawer={() => setIsNavDrawerOpen(prev => !prev)}\n        sortMode={sortMode}\n        onSortModeChange={setSortMode}"
);

// Remove HTML modal stuff
content = content.replace("import { SingleHtmlExporterModal } from './components/SingleHtmlExporterModal';", "");
content = content.replace("const [showHtmlExporterModal, setShowHtmlExporterModal] = useState(false);", "");
content = content.replace("onOpenHtmlModal={() => setShowHtmlExporterModal(true)}", "");
content = content.replace(/\{showHtmlExporterModal && \([\s\S]*?<\/SingleHtmlExporterModal>\s*\)\}/, "");

// Pass sortMode to EditMode
content = content.replace(
  "onToggleNavDrawer={() => setIsNavDrawerOpen(prev => !prev)}\n            />",
  "onToggleNavDrawer={() => setIsNavDrawerOpen(prev => !prev)}\n              sortMode={sortMode}\n            />"
);

fs.writeFileSync('src/App.tsx', content);
