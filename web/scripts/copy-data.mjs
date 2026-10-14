import { cpSync, existsSync, renameSync, rmSync } from 'node:fs';

const src = new URL('../../data/', import.meta.url);
const dest = new URL('../public/data/', import.meta.url);
const tmp = new URL('../public/data.tmp/', import.meta.url);
rmSync(tmp, { recursive: true, force: true });
if (existsSync(src)) {
  cpSync(src, tmp, { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  renameSync(tmp, dest);
  console.log('Copied data/ into web/public/data');
} else {
  console.warn('No data/ folder yet: run the pipeline first. The site will show a load error.');
}
