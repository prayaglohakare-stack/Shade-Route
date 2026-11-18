import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

// 1. Copy index.html -> 404.html for GitHub Pages SPA routing
const indexPath = path.join(distDir, 'index.html');
const notFoundPath = path.join(distDir, '404.html');
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log('✓ Copied index.html to 404.html');
}

// 2. Resolve git commit hash or timestamp for cache busting
let buildHash = '';
try {
  buildHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  buildHash = Date.now().toString(36);
}

// 3. Inject versioned build hash into dist/sw.js
const swPath = path.join(distDir, 'sw.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf-8');
  swContent = swContent.replace(/__BUILD_HASH__/g, buildHash);
  fs.writeFileSync(swPath, swContent, 'utf-8');
  console.log(`✓ Injected build hash [${buildHash}] into dist/sw.js`);
}
