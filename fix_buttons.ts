import fs from 'fs';

let content = fs.readFileSync('src/components/TopToolbar.tsx', 'utf-8');

// 1. Remove text inside buttons
content = content.replace(/<span>ניווט וחיפוש<\/span>/g, "");
content = content.replace(/<span>שינוי ספרים<\/span>/g, "");
content = content.replace(/<span>שמירה<\/span>/g, "");
content = content.replace(/<span>פתיחה<\/span>/g, "");
content = content.replace(/<span>יצוא ZIP<\/span>/g, "");

// 2. Adjust paddings for icon-only buttons
// For ListTree button
content = content.replace("px-3 py-1.5 text-xs font-bold rounded-lg", "p-2 rounded-lg");
// For RotateCcw button
content = content.replace("px-3 py-1.5 text-xs font-semibold bg-[var(--color-surface)]", "p-2 font-semibold bg-[var(--color-surface)]");
// For Save button
content = content.replace("px-3.5 py-1.5 text-xs font-bold bg-[var(--color-primary)]", "p-2 bg-[var(--color-primary)]");
// For Open button
content = content.replace("px-3 py-1.5 text-xs font-semibold bg-[var(--color-surface)]", "p-2 font-semibold bg-[var(--color-surface)]");
// For Export button
content = content.replace("px-3.5 py-1.5 text-xs font-bold bg-emerald-700", "p-2 bg-emerald-700");

// Also remove gap-1.5 since they only have an icon (and maybe a badge for the first one)
content = content.replace(/inline-flex items-center gap-1\.5 p-2/g, "inline-flex items-center justify-center p-2");

fs.writeFileSync('src/components/TopToolbar.tsx', content);

let editContent = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// In EditMode, there might be buttons with text and icons
editContent = editContent.replace(/<span>\{\(linkObj\.status === 'approved' \|\| !linkObj\.status\) \? 'מאושר' : 'ממתין לבדיקה'\}<\/span>/g, "");
editContent = editContent.replace(/<span>\{isUnlinkedDrawerOpen \? 'סגור' : 'הצג'\}<\/span>/g, "");

// Fix padding for the toggle unlinked alert
editContent = editContent.replace("px-2.5 py-1.5 text-xs font-bold rounded-xl", "p-2 rounded-xl");

// For link status button
editContent = editContent.replace("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl", "inline-flex items-center justify-center p-1.5 rounded-xl");

fs.writeFileSync('src/components/EditMode.tsx', editContent);
