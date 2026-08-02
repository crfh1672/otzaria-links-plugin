import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// Replace sortMode
content = content.replace(
  "const [filterMode, setFilterMode] = useState<'all' | 'linked' | 'unlinked' | 'high_confidence' | 'low_confidence' | 'pending'>('all');",
  "const [sortMode, setSortMode] = useState<'book_order' | 'score_asc' | 'score_desc'>('book_order');"
);

// We need to also pass sortMode and setSortMode to TopToolbar, but currently they are inside EditMode. 
