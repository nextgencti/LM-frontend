const fs = require('fs');
const content = fs.readFileSync('src/pages/Reports.jsx', 'utf-8');
const renderStart = content.indexOf('return (');
const block = content.substring(renderStart);

const opens = (block.match(/<div[ >]/g) || []).length;
const closes = (block.match(/<\/div>/g) || []).length;
console.log(`Opens: ${opens}, Closes: ${closes}, Diff: ${opens - closes}`);
