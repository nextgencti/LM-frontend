const fs = require('fs');
const content = fs.readFileSync('src/pages/Reports.jsx', 'utf-8');

const renderBlock = content.substring(content.indexOf('return ('));

const stack = [];
const regex = /<\/?([a-zA-Z0-9]+)[^>]*?(\/?)>/g;

let match;
while ((match = regex.exec(renderBlock)) !== null) {
  const isClosing = match[0].startsWith('</');
  const tag = match[1];
  const isSelfClosing = match[2] === '/';
  
  // ignore self-closing tags like <input /> or <br />
  if (isSelfClosing) continue;

  if (isClosing) {
    if (stack.length === 0) {
      console.log(`Found closing tag </${tag}> without open tag!`);
    } else {
      const last = stack.pop();
      if (last !== tag) {
        console.log(`Mismatched tags! Expected </${last}> but found </${tag}>. Near index: ${match.index}`);
      }
    }
  } else {
    stack.push(tag);
  }
}

if (stack.length > 0) {
  console.log("Unclosed tags stack:", stack);
} else {
  console.log("All tags balanced.");
}
