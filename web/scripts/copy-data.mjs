import { cpSync, existsSync, rmSync } from 'node:fs';

const src = new URL('../../data/', import.meta.url);
const dest = new URL('../public/data/', import.meta.url);
rmSync(dest, { recursive: true, force: true });
if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
  console.log('Copied data/ into web/public/data');
} else {
  console.warn('No data/ folder yet: run the pipeline first. The site will show a load error.');
}
