import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// Fix unlinked drawer button
content = content.replace(
  'className="px-2.5 py-1 text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100 hover:bg-rose-200 dark:hover:bg-rose-900 rounded-xl transition-colors flex items-center gap-1"',
  'className="p-1.5 text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100 hover:bg-rose-200 dark:hover:bg-rose-900 rounded-xl transition-colors inline-flex items-center justify-center"'
);

fs.writeFileSync('src/components/EditMode.tsx', content);
