import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const portraitPath = path.join(projectRoot, 'public', 'images', 'recovery-hero-portrait.png');
const fallbackPath = path.join(process.env.USERPROFILE || '', '.cursor', 'projects', 'c-Users-Amith-Prasad-Amith-s-Libraries-NEW-ERP-tarka-new-erp', 'assets', 'recovery-hero-panel.png');
const outputPath = path.join(projectRoot, 'public', 'images', 'recovery-hero.png');

const WIDTH = 2152;
const HEIGHT = 2032;
const BG = { r: 2, g: 8, b: 23, alpha: 1 };

async function main() {
  let sourcePath = portraitPath;
  if (!fs.existsSync(sourcePath)) {
    console.warn('Portrait missing, using fallback:', fallbackPath);
    sourcePath = fallbackPath;
  }
  if (!fs.existsSync(sourcePath)) {
    console.error('No source image found.');
    process.exit(1);
  }
  const resized = await sharp(sourcePath).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, resized);
  const stat = await fs.promises.stat(outputPath);
  console.log('Source:', sourcePath);
  console.log('Output:', outputPath);
  console.log('Dimensions:', meta.width + ' x ' + meta.height);
  console.log('File size:', stat.size, 'bytes (' + (stat.size / 1024).toFixed(2) + ' KB)');
  console.log('SUCCESS');
}

main().catch((err) => {
  console.error('FAILURE:', err);
  process.exit(1);
});