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
    const lineNum = i + 1 + 700 - 1;
    if (match[0].startsWith('<div')) {
      stack.push(lineNum);
      console.log(`Push ${lineNum}: ${lines[i].trim()}`);
    } else {
      if (stack.length === 0) {
        console.log(`Extra Close at ${lineNum}`);
      } else {
        const popped = stack.pop();
        console.log(`Pop ${lineNum} closes ${popped}`);
      }
    }
  }
}
