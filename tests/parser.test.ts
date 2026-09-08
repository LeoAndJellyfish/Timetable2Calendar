import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DOMParser } from 'linkedom';
import { collectSchedule } from '../src/lib/extract.js';
import { parseInput, parsePeriods, parseWeeks, MAX_INPUT_BYTES } from '../src/lib/parser';
import { coursePayload } from '../src/lib/settings';
import { demoResult, DEMO_PAYLOAD } from './fixtures/schedule';

const fixture = readFileSync(new URL('./fixtures/cufe.html', import.meta.url), 'utf8');
describe('CUFE saved HTML and JSON backups', () => {
  it('inherits omitted course title but preserves teacher/week splits', () => {
    const parsed = parseInput(fixture);
    expect(parsed.courses).toHaveLength(5);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.term).toBe('2026-2027学年第1学期');
    expect(parsed.courses[0]).toMatchObject({ name: '示例课程甲', day: 1, periods: [7, 8], teacher: '甲老师', location: '示例楼 A201' });
    expect(parsed.courses[1]).toMatchObject({ name: '示例课程甲', teacher: '乙老师', weeks: [9, 10, 11, 12, 13, 14, 15, 16] });
    expect(parsed.courses[3].pending).toBe(true);
  });
  it('exports only whitelisted course fields', () => {
    const doc = new DOMParser().parseFromString(fixture, 'text/html');
    const serialized = JSON.stringify(collectSchedule(doc));
    expect(serialized).not.toContain('不应提取');
    expect(serialized).not.toContain('Hidden alternate');
    expect(parseInput(serialized).courses).toEqual(parseInput(fixture).courses);
  });
  it('reads a saved webpage without its companion resource folder', () => {
    const saved = fixture.replace('<html>', '<!-- saved from url=(0024)https://example.invalid/ --><html>')
      .replace('</head>', '<link rel="stylesheet" href="课表_files/styles.css"><script src="课表_files/app.js"></script></head>')
      .replace('</body>', '<img src="课表_files/logo.png"></body>');
    expect(parseInput(saved)).toEqual(parseInput(fixture));
  });
  it('does not execute scripts in imported HTML', () => {
    const parsed = parseInput(fixture.replace('</body>', '<script>throw new Error("executed")</script><img src="https://example.invalid/tracker" onerror="throw 1"></body>'));
    expect(parsed.courses).toHaveLength(5);
  });
  it('reports invalid records without quietly discarding all courses', () => {
    const parsed = parseInput(JSON.stringify({ ...DEMO_PAYLOAD, records: [...DEMO_PAYLOAD.records, { name: '坏数据', day: 8, time: '(1-2节)1-16周' }] }));
    expect(parsed.courses).toHaveLength(10);
    expect(parsed.warnings[0]).toMatch(/第 11 条未导入/);
  });
  it('rejects unrecognized pages, malformed inputs and oversized files', () => {
    expect(() => parseInput('<html><body>登录</body></html>')).toThrow('未找到课表');
    expect(() => parseInput('https://xuanke.cufe.edu.cn')).toThrow('网址');
    expect(() => parseInput('{')).toThrow('JSON');
    expect(() => parseInput('{}')).toThrow('支持的课表');
    expect(() => parseInput('x'.repeat(MAX_INPUT_BYTES + 1))).toThrow('5 MB');
  });
  it('deduplicates repeated records with a visible warning', () => {
    const parsed = parseInput(JSON.stringify({ ...DEMO_PAYLOAD, records: [DEMO_PAYLOAD.records[0], DEMO_PAYLOAD.records[0]] }));
    expect(parsed.courses).toHaveLength(1);
    expect(parsed.warnings[0]).toContain('已去重');
  });
  it('course JSON round-trips split weeks, notes and pending status', () => {
    const parsed = parseInput(fixture);
    const restored = parseInput(JSON.stringify(coursePayload(parsed.courses, parsed.term)));
    expect(restored.courses.map(({ weekText, ...course }) => course)).toEqual(parsed.courses.map(({ weekText, ...course }) => course));
    expect(demoResult().courses).toHaveLength(10);
  });
});

describe('weeks and periods', () => {
  it.each([
    ['1-6周', [1, 2, 3, 4, 5, 6]],
    ['1-8周(单)', [1, 3, 5, 7]],
    ['2-8周（双）', [2, 4, 6, 8]],
    ['第1—3周、7周、9-11周', [1, 2, 3, 7, 9, 10, 11]],
    ['1,3,5,7周', [1, 3, 5, 7]],
    ['１-６周(双)，9-11(单)周', [2, 4, 6, 9, 11]],
  ])('parses %s', (input, expected) => expect(parseWeeks(input)).toEqual(expected));
  it.each(['', '0-3周', '16-1周', '1-54周', '每周', '1周(双)', '1-8周,'])('rejects ambiguous/out-of-range weeks: %s', input => expect(() => parseWeeks(input)).toThrow());
  it('preserves gaps between periods', () => expect(parsePeriods('1-2,5-6节')).toEqual([1, 2, 5, 6]));
  it.each(['0-2节', '6-3节', '25节', '1-2节垃圾'])('rejects invalid periods: %s', input => expect(() => parsePeriods(input)).toThrow());
});
