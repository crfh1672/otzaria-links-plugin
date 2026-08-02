import fs from 'fs';

let content = fs.readFileSync('src/components/EditMode.tsx', 'utf-8');

// Fix CollapsibleCommentary IIFE
content = content.replace(
  "return <CollapsibleCommentary html={formattedHtml} />;\n        })}",
  "return <CollapsibleCommentary html={formattedHtml} />;\n        })()}"
);

// Fix Target Source Line IIFE
const targetSourceIIFE = `
                    {(() => {
                      const targetType = firstLinkObj?.secondaryTarget || 'primary';
                      const colors = getTargetColors(targetType);
                      return (
                    <>`;

const exactIIFEEndRegex = /<\/>\s*?\n\s*\);\s*\n\s*\}\)}/g;

content = content.replace(exactIIFEEndRegex, "</>\n                    );\n                    })()}");

fs.writeFileSync('src/components/EditMode.tsx', content);
