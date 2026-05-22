import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve('out');
const destDir = path.resolve('dist/client');

console.log(`[CopyClient] Copying static assets from ${srcDir} to ${destDir}...`);

try {
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log('[CopyClient] Client assets copied successfully.');
} catch (error) {
  console.error('[CopyClient] Failed to copy client assets:', error);
  process.exit(1);
}
