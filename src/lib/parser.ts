import { DOMParser } from 'linkedom';
import { collectSchedule } from './extract.js';
import type { Course, ImportResult } from './types';

export const MAX_INPUT_BYTES = 5 * 1024 * 1024;

function normalize(value: string): string {
  return value.replace(/[０-９]/g, s => String(s.charCodeAt(0) - 0xff10))
    .replace(/[（【\[]/g, '(').replace(/[）】\]]/g, ')')
    .replace(/[—–－~～至]/g, '-').replace(/[，、；;]/g, ',').replace(/\s+/g, '');
}

export function parseWeeks(value: string): number[] {
  const normalized = normalize(value).replace(/第/g, '');
  if (!normalized) throw new Error('缺少周次');
  const weeks = new Set<number>();
  for (const raw of normalized.split(',')) {
    const part = raw.replace(/周次|周/g, '').replace(/星期/g, '');
    const match = part.match(/^(\d+)(?:-(\d+))?(?:\(?([单双])\)?)?$/);
    if (!match) throw new Error(`无法识别周次「${raw}」`);
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end > 53 || start > end) throw new Error(`周次超出范围「${raw}」`);
    for (let week = start; week <= end; week++) {
      if (!match[3] || (match[3] === '单' ? week % 2 === 1 : week % 2 === 0)) weeks.add(week);
    }
  }
  if (!weeks.size) throw new Error('周次规则没有对应的上课周');
  return [...weeks].sort((a, b) => a - b);
}

export function parsePeriods(value: string): number[] {
  const normalized = normalize(value).replace(/第|节|\(|\)/g, '');
  const periods = new Set<number>();
  for (const raw of normalized.split(',')) {
    const match = raw.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error(`无法识别节次「${value}」`);
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (start < 1 || end > 24 || start > end) throw new Error(`节次超出范围「${value}」`);
    for (let period = start; period <= end; period++) periods.add(period);
  }
  return [...periods].sort((a, b) => a - b);
}

export function compactNumbers(values: number[]): string {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const start = sorted[index];
    let end = start;
    while (sorted[index + 1] === end + 1) end = sorted[++index];
    parts.push(start === end ? `${start}` : `${start}–${end}`);
  }
  return parts.join('、');
}

// Two independently seeded 32-bit hashes keep identifiers deterministic without personal IDs.
export function stableId(value: string): string {
  let a = 2166136261, b = 3339675911;
  for (const char of value) {
    a = Math.imul(a ^ char.codePointAt(0)!, 16777619);
    b = Math.imul(b ^ char.codePointAt(0)!, 2246822519);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

function textField(record: Record<string, unknown>, field: string, max = 1000): string {
  if (record[field] == null) return '';
  if (typeof record[field] !== 'string' || record[field].length > max) throw new Error(`字段 ${field} 格式不正确`);
  return record[field].replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

export function parseInput(input: string): ImportResult {
  const raw = input.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('请先选择课表文件，或粘贴 HTML / JSON 备份内容。');
  if (new TextEncoder().encode(raw).length > MAX_INPUT_BYTES) throw new Error('文件超过 5 MB，请只保存个人课表，或改用教务系统导出的 PDF。');
  let payload: unknown;
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try { payload = JSON.parse(raw); } catch { throw new Error('JSON 内容不完整，请重新导入备份文件或复制完整内容。'); }
  } else if (raw.startsWith('<')) {
    // linkedom parses without a browser document: scripts and resource URLs never execute or load.
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    payload = collectSchedule(doc);
  } else {
    throw new Error('请粘贴保存的 HTML 网页或课历 JSON 备份；PDF 请通过文件选择导入，网址和截图暂不支持。');
  }
  if (!payload || typeof payload !== 'object' || !('format' in payload) || payload.format !== 'timetable2calendar' || !('version' in payload) || payload.version !== 1 || !('records' in payload) || !Array.isArray(payload.records)) {
    throw new Error('这不是支持的课表 JSON。请导入课历保存的 JSON 备份，或使用教务课表 PDF / HTML。');
  }
  if (!payload.records.length || payload.records.length > 1000) throw new Error('课表条数需要在 1–1000 之间。');
  const result: ImportResult = {
    courses: [], term: 'term' in payload && typeof payload.term === 'string' ? payload.term.slice(0, 100) : '',
    warnings: [], sourceCount: payload.records.length,
  };
  const seen = new Set<string>();
  payload.records.forEach((record: unknown, index: number) => {
    try {
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('课程记录格式不正确');
      const item = record as Record<string, unknown>;
      const name = textField(item, 'name', 200);
      if (!name) throw new Error('缺少课程名称');
      if (!Number.isInteger(item.day) || Number(item.day) < 1 || Number(item.day) > 7) throw new Error('缺少或无法识别星期');
      const time = normalize(textField(item, 'time', 300));
      const match = time.match(/^\(([^()]+节)\)(.+)$/);
      if (!match) throw new Error(`无法识别节次/周次「${time}」`);
      const course: Course = {
        id: '', name, day: Number(item.day), periods: parsePeriods(match[1]), weeks: parseWeeks(match[2]),
        weekText: match[2], teacher: textField(item, 'teacher'), location: textField(item, 'location'),
        className: textField(item, 'className'), notes: textField(item, 'notes'), pending: item.pending === true,
      };
      course.id = stableId(JSON.stringify([course.name, course.className, course.day, course.periods, course.weeks, course.teacher, course.location, course.pending]));
      if (seen.has(course.id)) { result.warnings.push(`第 ${index + 1} 条「${name}」与已有排课完全重复，已去重。`); return; }
      seen.add(course.id);
      result.courses.push(course);
    } catch (error) {
      result.warnings.push(`第 ${index + 1} 条未导入：${error instanceof Error ? error.message : '格式错误'}。`);
    }
  });
  if (!result.courses.length) throw new Error(`未能解析出有效课程。${result.warnings.slice(0, 3).join(' ')}`);
  return result;
}
