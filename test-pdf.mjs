import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';

const data = new Uint8Array(fs.readFileSync('/Users/salva/Documents/Desarrollo/Python/Merca roba/20251118 Mercadona 5,45 €.pdf'));
const pdf = await pdfjsLib.getDocument({data}).promise;

let fullText = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  fullText += content.items.map(item => item.str).join(' ') + '\n';
}

console.log('=== PRIMEROS 1000 CARACTERES ===');
console.log(fullText.substring(0, 1000));
console.log('\n=== BUSCAR MERCADONA ===');
const lines = fullText.split('\n');
for (let i = 0; i < Math.min(lines.length, 20); i++) {
  if (lines[i].includes('MERCADONA') || lines[i].includes('C/') || lines[i].includes('c/')) {
    console.log(`Línea ${i}: ${lines[i]}`);
  }
}
