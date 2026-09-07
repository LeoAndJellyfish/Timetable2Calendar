import { expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import ICAL from 'ical.js';
import { readPdfPages } from '../src/lib/pdf-reader';
import { parsePdfLayout } from '../src/lib/pdf-layout';
import { generateIcs } from '../src/lib/calendar';
import { initialSettings } from '../src/lib/settings';

// Opt-in comparison against the user's private reference; no personal data is stored in fixtures.
const referencePath = process.env.CALENDAR_REFERENCE_FILE;
const pdfPaths: string[] = JSON.parse(process.env.PDF_SAMPLE_FILES || '[]');
it.skipIf(!referencePath || !pdfPaths.length)('matches all 188 reference events on title, room, teacher, start and end', async () => {
  const packageRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const pages = await readPdfPages(readFileSync(pdfPaths[0]), {
    cMapUrl: join(packageRoot, 'cmaps') + '/', standardFontDataUrl: join(packageRoot, 'standard_fonts') + '/',
  });
  const courses = parsePdfLayout(pages).courses;
  const settings = { ...initialSettings(), firstMonday: '2026-09-07', timesConfirmed: true };
  const generated = generateIcs(courses, settings);
  const actual = new ICAL.Component(ICAL.parse(generated.text));
  const reference = new ICAL.Component(ICAL.parse(readFileSync(referencePath!, 'utf8')));
  const entries = (calendar: ICAL.Component) => calendar.getAllSubcomponents('vevent').map(component => {
    const event = new ICAL.Event(component);
    return JSON.stringify({ name: event.summary, location: event.location, description: event.description,
      start: event.startDate.toUnixTime(), end: event.endDate.toUnixTime() });
  }).sort();
  expect(generated.count).toBe(188);
  expect(entries(actual)).toEqual(entries(reference));
  const events = actual.getAllSubcomponents('vevent');
  expect(events.every(event => !event.getFirstSubcomponent('valarm') && !event.getFirstProperty('rrule'))).toBe(true);
  expect(actual.getFirstPropertyValue('x-apple-calendar-color')).toBe(reference.getFirstPropertyValue('x-apple-calendar-color'));
  expect(actual.getFirstPropertyValue('prodid')).not.toBe(reference.getFirstPropertyValue('prodid'));
  if (process.env.CALENDAR_OUTPUT_FILE) writeFileSync(process.env.CALENDAR_OUTPUT_FILE, generated.text, 'utf8');
}, 60000);
