import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { readPdfPages } from '../src/lib/pdf-reader';
import { parsePdfLayout } from '../src/lib/pdf-layout';
import { expandCourses, generateIcs } from '../src/lib/calendar';
import { initialSettings } from '../src/lib/settings';
import ICAL from 'ical.js';

// Optional integration test: personal PDF samples stay outside source control.
const paths: string[] = JSON.parse(process.env.PDF_SAMPLE_FILES || '[]');
it.skipIf(paths.length !== 2)('the supplied grid and list PDFs produce the same 14 segments and 188 valid calendar events', async () => {
  const packageRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const results = [];
  for (const path of paths) {
    const pages = await readPdfPages(readFileSync(path), {
      cMapUrl: join(packageRoot, 'cmaps') + '/',
      standardFontDataUrl: join(packageRoot, 'standard_fonts') + '/',
    });
    const result = parsePdfLayout(pages);
    expect(result.warnings).toEqual([]);
    expect(result.term).toBe('2026-2027学年第1学期');
    expect(result.courses).toHaveLength(14);
    expect(new Set(result.courses.map(course => course.name)).size).toBe(13);
    expect(result.courses.every(course => course.teacher && course.location && course.className)).toBe(true);
    const settings = { ...initialSettings(), firstMonday: '2026-09-07', timesConfirmed: true };
    const occurrences = expandCourses(result.courses, settings);
    expect(occurrences).toHaveLength(188);
    const calendar = new ICAL.Component(ICAL.parse(generateIcs(result.courses, settings).text));
    const events = calendar.getAllSubcomponents('vevent');
    expect(events).toHaveLength(188);
    expect(new Set(events.map(event => event.getFirstPropertyValue('uid'))).size).toBe(188);
    results.push(result.courses.sort((a, b) => a.id.localeCompare(b.id)));
  }
  expect(results[0]).toEqual(results[1]);
}, 60000);
