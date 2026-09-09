import { parseInput } from './parser';
import type { ImportResult } from './types';

/** Text coordinates after applying the PDF page viewport (including rotation). */
export interface PdfText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PdfPage { width: number; height: number; items: PdfText[] }
interface RecordDraft {
  name: string;
  day: number;
  time: string;
  teacher: string;
  location: string;
  className: string;
  credits: string;
  notes: string;
}

const dayPattern = /^(?:星期|周)([一二三四五六日天])$/;
const activity = /[★☆○◆◇●]+$/;
const tidy = (text: string) => text.replace(/\s+/g, '').replace(/：/g, ':');
const dayNumber = (text: string) => {
  const match = tidy(text).match(dayPattern);
  return match ? Math.min('一二三四五六日天'.indexOf(match[1]) + 1, 7) : 0;
};
const footer = (text: string) => /^(?:打印时间|[★☆○◆◇●]\s*[:：])/.test(text.trim());
const fieldPattern = /(?:^|\/)(周数|校区|场地|地点|教室|教师|教学班组成|教学班|考核方式|选课备注|课程学时组成|周学时|总学时|学分):/g;

function fields(text: string): Map<string, string> {
  const normalized = tidy(text);
  const labels = [...normalized.matchAll(fieldPattern)];
  return new Map(labels.map((match, index) => [match[1], normalized.slice(match.index! + match[0].length, labels[index + 1]?.index ?? normalized.length)]));
}

function record(name: string, day: number, time: string, content: string): RecordDraft {
  const values = fields(content);
  return {
    name: name.replace(activity, '').trim(), day, time,
    teacher: values.get('教师') || '',
    location: [values.get('校区'), values.get('场地') || values.get('地点') || values.get('教室')].filter(Boolean).join(' '),
    className: values.get('教学班') || '', notes: values.get('选课备注') || '',
    credits: values.get('学分') || '',
  };
}

/** Merge glyph fragments on one baseline, but only after isolating a table column. */
function lines(items: PdfText[]): PdfText[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: PdfText[][] = [];
  for (const item of sorted) {
    const previous = groups.at(-1);
    if (previous && Math.abs(previous[0].y - item.y) < Math.max(1, item.height * 0.15)) previous.push(item);
    else groups.push([item]);
  }
  return groups.map(group => {
    group.sort((a, b) => a.x - b.x);
    return { ...group[0], text: group.map(item => item.text).join(''), height: Math.max(...group.map(item => item.height)) };
  });
}

function gridHeader(page: PdfPage): PdfText[] | undefined {
  const headers = page.items.filter(item => dayNumber(item.text));
  const first = headers.find(item => dayNumber(item.text) === 1);
  if (!first) return;
  const row = headers.filter(item => Math.abs(item.y - first.y) < first.height * 0.5).sort((a, b) => a.x - b.x);
  if (row.length === 7 && row.every((item, index) => dayNumber(item.text) === index + 1)) return row;
}

function parseGrid(pages: PdfPage[], initialHeader: PdfText[], headerPage: PdfPage): { records: RecordDraft[]; warnings: string[] } {
  const columns: PdfText[][] = Array.from({ length: 7 }, () => []);
  const warnings: string[] = [];
  let pageOffset = 0;
  for (const page of pages) {
    const header = gridHeader(page);
    const headerCenters = (header || initialHeader).map(item => (item.x + item.width / 2) / (header ? page.width : headerPage.width));
    const spacing = headerCenters[1] - headerCenters[0];
    const firstLeft = headerCenters[0] - spacing / 2;
    const lastRight = headerCenters[6] + spacing / 2;
    for (const item of page.items) {
      if (footer(item.text) || item.height >= 18 || /^学号\s*[:：]/.test(item.text) || /学年第.*学期/.test(item.text) || dayNumber(item.text)) continue;
      if (header && item.y <= header[0].y + 1) continue;
      const center = (item.x + item.width / 2) / page.width;
      if (center < firstLeft || center > lastRight) continue;
      const column = headerCenters.reduce((best, value, index) => Math.abs(center - value) < Math.abs(center - headerCenters[best]) ? index : best, 0);
      columns[column].push({ ...item, y: item.y + pageOffset });
    }
    // Following pages may start inside a course. Keep their text in the same column stream.
    pageOffset += page.height + 10;
  }
  const records: RecordDraft[] = [];
  for (const [column, items] of columns.entries()) {
    const columnLines = lines(items);
    const exampleTime = columnLines.find(item => /[（(].*节/.test(item.text));
    const bodySize = exampleTime?.height ?? 8;
    let name = '', content = '', collectingTitle = false;
    function flush() {
      if (!name && !content) return;
      const text = tidy(content);
      const matches = [...text.matchAll(/[（(]([\d０-９,，、\-–—～~]+)节[）)]([^/]*?周(?:[（(]?[单双]周?[）)]?)?)(?=\/|$)/g)];
      if (name && !matches.length) warnings.push(`周${'一二三四五六日'[column]}「${name}」缺少可识别的节次或周次，未导入。`);
      matches.forEach((match, index) => records.push(record(name, column + 1, `(${match[1]}节)${match[2]}`, text.slice(match.index, matches[index + 1]?.index))));
    }
    for (const item of columnLines) {
      const text = item.text.trim();
      const isTitle = (item.height > bodySize * 1.06 || activity.test(text)) && !/[/:：]/.test(text) && !/^[（(].*节/.test(text);
      if (isTitle) {
        if (!collectingTitle) { flush(); name = ''; content = ''; }
        name += text;
        collectingTitle = true;
      } else {
        content += text;
        collectingTitle = false;
      }
    }
    flush();
  }
  return { records, warnings };
}

function parseList(pages: PdfPage[]): { records: RecordDraft[]; warnings: string[] } {
  const records: RecordDraft[] = [];
  const warnings: string[] = [];
  let day = 0, periods = '', name = '', content = '', titleParts = '';
  let courseColumn: number | undefined, detailsColumn: number | undefined;
  function flush() {
    name ||= titleParts;
    if (!name && !content) return;
    if (name || /周数\s*[:：]/.test(content)) {
      const weeks = fields(content).get('周数');
      if (!day || !periods || !name || !weeks) warnings.push(`「${name || '未命名课程'}」缺少星期、节次或周次，未导入。`);
      else records.push(record(name, day, `(${periods}节)${weeks}`, content));
    }
    name = ''; content = ''; titleParts = '';
  }
  // CUFE's list export writes merged weekday/period labels BEFORE their child rows,
  // even though the labels are vertically centered. Sorting by y would misassign them.
  for (const page of pages) {
    const weekItem = page.items.find(item => /^周数\s*[:：]/.test(item.text.trim()));
    if (weekItem) detailsColumn = weekItem.x / page.width;
    const titleItem = page.items.find(item => activity.test(item.text.trim()) && !footer(item.text)) || page.items.find(item =>
      weekItem && item.height > weekItem.height * 1.06 && item.height < 12 && item.x < weekItem.x && item.y > weekItem.y - 10);
    if (titleItem) courseColumn = titleItem.x / page.width;
    for (const item of page.items) {
      const text = item.text.trim(), x = item.x / page.width;
      if (!text || footer(text) || item.height >= 18 || /^学号\s*[:：]/.test(text) || /学年第.*学期/.test(text)) continue;
      const nextDay = dayNumber(text);
      if (nextDay && x < (courseColumn ?? 0.3)) { flush(); day = nextDay; periods = ''; continue; }
      if (/^[\d０-９]+(?:[-–—][\d０-９]+)?$/.test(tidy(text)) && x < (courseColumn ?? 0.3)) { flush(); periods = text; continue; }
      if (detailsColumn !== undefined && x >= detailsColumn - 0.01) { name ||= titleParts; titleParts = ''; content += text; continue; }
      if (courseColumn !== undefined && x >= courseColumn - 0.01 && x < (detailsColumn ?? 1)) {
        if (name || content) flush();
        titleParts += text;
        if (activity.test(titleParts)) { name = titleParts; titleParts = ''; }
      }
    }
  }
  flush();
  return { records, warnings };
}

export function parsePdfLayout(pages: PdfPage[]): ImportResult {
  if (!pages.some(page => page.items.some(item => item.text.trim()))) throw new Error('PDF 中没有可读取的文字，可能是扫描件或图片。请导入教务系统直接输出的文字版 PDF。');
  const headerPage = pages.find(page => gridHeader(page));
  const isList = pages.some(page => page.items.some(item => /^周数\s*[:：]/.test(item.text.trim()))) && pages.some(page => page.items.some(item => dayNumber(item.text)));
  if (!headerPage && !isList) throw new Error('未识别出中财教务课表。支持教务系统「表格」或「列表」视图直接输出的文字版 PDF。');
  const parsed = headerPage ? parseGrid(pages, gridHeader(headerPage)!, headerPage) : parseList(pages);
  if (!parsed.records.length) throw new Error(`未能从 PDF 读取有效课程。${parsed.warnings.slice(0, 3).join(' ')}`);
  const term = pages.flatMap(page => page.items).map(item => tidy(item.text)).find(text => /^\d{4}-\d{4}学年第\d学期$/.test(text)) || '';
  const result = parseInput(JSON.stringify({ format: 'timetable2calendar', version: 1, term, records: parsed.records }));
  result.warnings.unshift(...parsed.warnings);
  result.sourceCount += parsed.warnings.length;
  return result;
}
