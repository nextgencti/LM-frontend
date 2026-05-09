const fs = require('fs');
const content = fs.readFileSync('src/pages/Reports.jsx', 'utf-8');
const renderStart = content.indexOf('return (');
const block = content.substring(renderStart);

const lines = block.split('\n');
const stack = [];
const regex = /<div[ >]|<\/div>/g;

for (let i = 0; i < lines.length; i++) {
  let match;
  while ((match = regex.exec(lines[i])) !== null) {
    if (match[0].startsWith('<div')) {
      stack.push({ line: i + 1 + 700 - 1, content: lines[i].trim() });
    } else {
      if (stack.length === 0) {
        console.log(`Extra closing div at line ${i + 1 + 700 - 1}`);
      } else {
        stack.pop();
      }
    }
  }
}

if (stack.length > 0) {
  console.log("Unclosed divs:");
  stack.forEach(s => console.log(`Line ${s.line}: ${s.content}`));
} else {
  console.log("All divs balanced.");
}
