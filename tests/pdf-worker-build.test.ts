import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'vite';

it('publishes a referenced PDF worker as .js without changing its module content', async () => {
  const result = await build({ logLevel: 'silent', build: { write: false } });
  if (!result || 'on' in result) throw new Error('Expected a one-shot production build');
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
  const worker = outputs.find(output => /pdf\.worker\.min-/.test(output.fileName));
  expect(worker?.fileName).toMatch(/^assets\/pdf\.worker\.min-[\w-]+\.js$/);
  if (!worker || worker.type !== 'asset') throw new Error('Missing PDF worker asset');
  const original = readFileSync(createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'));
  expect(Buffer.from(worker.source)).toEqual(original);
  expect(outputs.some(output => output.type === 'chunk' && output.code.includes(worker.fileName))).toBe(true);
  expect(outputs.some(output => output.fileName.endsWith('.mjs'))).toBe(false);
}, 30000);
