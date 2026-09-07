import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { readPdfPages } from './pdf-reader';
import { parsePdfLayout } from './pdf-layout';
import { MAX_INPUT_BYTES } from './parser';
import type { ImportResult } from './types';

export async function parsePdf(buffer: ArrayBuffer, onProgress?: (page: number, total: number) => void): Promise<ImportResult> {
  if (buffer.byteLength > MAX_INPUT_BYTES) throw new Error('文件超过 5 MB，请只导入个人课表。');
  const assets = new URL(`${import.meta.env.BASE_URL}pdfjs-assets/`, window.location.href);
  const pages = await readPdfPages(buffer, {
    workerSrc: workerUrl,
    cMapUrl: new URL('cmaps/', assets).href,
    standardFontDataUrl: new URL('standard_fonts/', assets).href,
    onProgress,
  });
  return parsePdfLayout(pages);
}
