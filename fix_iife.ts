import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// Undo all `})()}`
content = content.replace(/\}\)\(\)\}/g, "})}");

// Now carefully fix the IIFE for Target Source Line
const searchTarget = `                    {(() => {
                      const targetType = firstLinkObj?.secondaryTarget || 'primary';
                      const colors = getTargetColors(targetType);
                      return (
                    <>`;

const exactIIFEEndRegex = /<\/>\s*?\n\s*\);\s*\n\s*\}\)}/g;

content = content.replace(exactIIFEEndRegex, "</>\n                    );\n                    })()}");

fs.writeFileSync('src/components/EditMode.tsx', content);
