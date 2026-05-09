const fs = require('fs');
const { parse } = require('@babel/parser');

try {
  const code = fs.readFileSync('src/pages/Reports.jsx', 'utf-8');
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log("No syntax errors found!");
} catch (e) {
  console.error(`Syntax Error at line ${e.loc?.line}, col ${e.loc?.column}: ${e.message}`);
}
