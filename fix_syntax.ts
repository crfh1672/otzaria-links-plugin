import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// Fix 1: The broken button at 945-953
const brokenButtonRegex = /<button\s+onClick=\{\(\) => \{\s*\}\}\s+className=\{`px-2\.5 py-1 text-xs font-bold rounded-xl transition-colors border \$\{\s*\?\s*'bg-rose-600 text-white border-rose-600'\s*:\s*'bg-\[var\(--color-surface-container-low\)\] text-\[var\(--color-on-surface\)\] border-\[var\(--color-outline\)\] hover:bg-\[var\(--color-outline-variant\)\]'\s*\}\`\}\s*>\s*<\/button>/g;
content = content.replace(brokenButtonRegex, "");

// Fix 2: Around 830, there are broken buttons too.
const brokenFilterButtons = /<button\s+onClick=\{\(\) => \{\s*\}\}\s+className=\{`px-3 py-1\.5 text-xs font-bold rounded-lg transition-colors \$\{\s*\?.*?\s*:.*?\s*\}\`\}\s*>\s*.*?\s*<\/button>/g;
content = content.replace(brokenFilterButtons, "");

// Fix 3: unbalanced parens in drawer at the end
const badDrawerEnd = "                )))\n              )}\n              {/* End of nav tab */}\n              )} ";
const goodDrawerEnd = "                )))\n              )}";
content = content.replace(badDrawerEnd, goodDrawerEnd);

fs.writeFileSync('src/components/EditMode.tsx', content);
