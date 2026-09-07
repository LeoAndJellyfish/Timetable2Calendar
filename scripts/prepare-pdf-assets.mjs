import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pdfjs = dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
const destination = join(root, 'public', 'pdfjs-assets');
mkdirSync(destination, { recursive: true });
for (const name of ['cmaps', 'standard_fonts']) cpSync(join(pdfjs, name), join(destination, name), { recursive: true });
cpSync(join(pdfjs, 'LICENSE'), join(destination, 'LICENSE'));
