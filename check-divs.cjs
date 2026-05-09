// Let's use pure JS to match div tags.
const fs = require('fs');

const content = fs.readFileSync('src/pages/Reports.jsx', 'utf-8');
const renderStart = content.indexOf('return (');
const block = content.substring(renderStart);

const lines = block.split('\n');
const divStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Find all <div... and </div...
  const openMatches = line.match(/<div[ >]/g);
  const closeMatches = line.match(/<\/div>/g);
  
  if (openMatches) {
    for (let j = 0; j < openMatches.length; j++) divStack.push(i + 1); // 1-indexed relative to return block
  }
  
  if (closeMatches) {
    for (let j = 0; j < closeMatches.length; j++) {
      if (divStack.length > 0) {
        divStack.pop();
      } else {
        console.log(`Orphaned </div> on line ${i + 1} (relative)`);
      }
    }
  }
}

if (divStack.length > 0) {
  console.log("Unclosed <div>s opened on lines (relative to 'return ('):", divStack);
} else {
  console.log("All <div>s balanced.");
}
