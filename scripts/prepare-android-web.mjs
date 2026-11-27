import fs from 'fs';
import path from 'path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const androidWebDir = path.join(root, 'dist-android');

if (!fs.existsSync(distDir)) {
  console.error('dist/ does not exist. Run "npm run build" first.');
  process.exit(1);
}

fs.rmSync(androidWebDir, { recursive: true, force: true });
fs.cpSync(distDir, androidWebDir, {
  recursive: true,
  force: true,
  filter: (srcPath) => {
    const rel = path.relative(distDir, srcPath).replace(/\\/g, '/');
    if (!rel) return true;
    // Exclude unused reference attachments and generated APK/AAB download artifacts from the embedded APK web bundle
    if (rel === 'assets/aistudio' || rel.startsWith('assets/aistudio/')) return false;
    if (rel === 'downloads' || rel.startsWith('downloads/')) return false;
    return true;
  },
});

console.log('Prepared clean Android web bundle at dist-android/');
