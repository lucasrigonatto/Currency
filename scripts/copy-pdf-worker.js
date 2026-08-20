const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.js');

if (!fs.existsSync(src)) {
  console.warn('pdf.worker.min.js not found; skip copy');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
