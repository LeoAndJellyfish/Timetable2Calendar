import type { PdfPage } from './pdf-layout';

export interface PdfReadOptions {
  cMapUrl: string;
  standardFontDataUrl: string;
  workerSrc?: string;
  onProgress?: (page: number, total: number) => void;
  timeoutMs?: number;
}

export async function readPdfPages(buffer: ArrayBuffer | Uint8Array, options: PdfReadOptions): Promise<PdfPage[]> {
  const { getDocument, GlobalWorkerOptions, Util } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (options.workerSrc) GlobalWorkerOptions.workerSrc = options.workerSrc;
  const task = getDocument({
    data: new Uint8Array(buffer), cMapUrl: options.cMapUrl, cMapPacked: true,
    standardFontDataUrl: options.standardFontDataUrl,
    useWasm: false, useSystemFonts: true, disableFontFace: true,
    stopAtErrors: true, enableXfa: false,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    const document = await task.promise;
    if (document.numPages > 50) throw new Error('PDF 超过 50 页，请只导入个人课表。');
    const pages: PdfPage[] = [];
    let textSize = 0;
    for (let number = 1; number <= document.numPages; number++) {
      options.onProgress?.(number, document.numPages);
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter(item => 'str' in item && item.str.trim()).map(item => {
        if (!('str' in item)) throw new Error('无法读取 PDF 文字。');
        const transformed = Util.transform(viewport.transform, item.transform);
        textSize += item.str.length;
        return { text: item.str, x: transformed[4], y: transformed[5], width: item.width, height: item.height };
      });
      if (textSize > 500_000) throw new Error('PDF 文字内容过多，请只保留个人课表页面。');
      pages.push({ width: viewport.width, height: viewport.height, items });
      page.cleanup();
    }
    return pages;
  };
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('PDF 读取超时，请尝试从教务系统重新输出，或改用 HTML / JSON。')), options.timeoutMs ?? 30000);
    })]);
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('该 PDF 受密码保护，请先解除密码后再导入。');
    if (error instanceof Error && error.name === 'InvalidPDFException') throw new Error('PDF 文件损坏或不是有效 PDF，请重新从教务系统输出。');
    throw error;
  } finally {
    clearTimeout(timer);
    await task.destroy();
  }
}
