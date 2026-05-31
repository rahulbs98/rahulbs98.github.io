const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node tools/apply_profile_focus.js "X% Y%"');
  process.exit(1);
}

const cssValue = process.argv[2].trim();
if (!/^\d+%\s+\d+%$/.test(cssValue)) {
  console.error('Value must be like "52% 34%"');
  process.exit(1);
}

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const imgRegex = /(<img[^>]*class=("|')([^"']*\bprofile-img\b[^"']*)("|')[^>]*>)/i;
const match = html.match(imgRegex);
if (!match) {
  console.error('profile img tag not found in index.html');
  process.exit(1);
}

const imgTag = match[1];
let newTag;
if (/style=/.test(imgTag)) {
  newTag = imgTag.replace(/style=("|')([^"']*)("|')/i, (m, q1, styleContent) => {
    if (/object-position\s*:/i.test(styleContent)) {
      const replaced = styleContent.replace(/object-position\s*:\s*[^;]+;?/i, `object-position: ${cssValue}; `);
      return `style=${q1}${replaced}${q1}`;
    } else {
      const appended = styleContent.trim();
      const needsSemicolon = appended && !/;\s*$/.test(appended) ? '; ' : ' ';
      return `style=${q1}${appended}${needsSemicolon}object-position: ${cssValue};${q1}`;
    }
  });
} else {
  newTag = imgTag.replace(/(>)/, ` style="object-position: ${cssValue};"$1`);
}

html = html.replace(imgTag, newTag);
fs.writeFileSync(indexPath, html, 'utf8');
console.log('Applied object-position:', cssValue);
