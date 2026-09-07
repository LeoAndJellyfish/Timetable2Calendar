import { describe, expect, it } from 'vitest';
import { parsePdfLayout, type PdfPage, type PdfText } from '../src/lib/pdf-layout';

const text = (text: string, x: number, y: number, height = 8): PdfText => ({ text, x, y, height, width: text.length * height / 2 });
const page = (items: PdfText[]): PdfPage => ({ width: 842, height: 595, items });
const header = [text('2026-2027学年第1学期', 21, 50), text('虚构同学课表', 350, 58, 24), text('学号：不应导入', 720, 50), ...[...'一二三四五六日'].map((day, i) => text(`星期${day}`, 142 + i * 104, 81, 12))];
const detail = (weeks: string, teacher = '甲老师') => `周数:${weeks}/校区:示例校区/地点:示例楼201/教师:${teacher}/教学班:sample-01/选课备注:请带电脑/课程学时组成:讲课:32`;

describe('CUFE PDF table reconstruction with fictional text positions', () => {
  it('joins wrapped names and cross-page metadata, preserving titleless teacher splits', () => {
    const result = parsePdfLayout([
      page([...header, text('示例长课程', 110, 520, 9), text('名称★', 110, 529, 9), text('(7-8节)1-8周/校区:示例校区/', 110, 540), text('场地:示例教', 110, 548)]),
      page([text('室/教师:甲老师/教学班:sample-01/', 110, 25), text('选课备注:请带电脑/周学时:2', 110, 33), text('(7-8节)9-16周/教师:乙老师/', 110, 65), text('地点:另一教室/教学班:sample-01', 110, 73), text('打印时间：2026-09-07', 620, 570, 12)]),
    ]);
    expect(result.courses).toHaveLength(2);
    expect(result.warnings).toEqual([]);
    expect(result.term).toBe('2026-2027学年第1学期');
    expect(result.courses[0]).toMatchObject({ name: '示例长课程名称', day: 1, periods: [7, 8], weeks: [1, 2, 3, 4, 5, 6, 7, 8], teacher: '甲老师', location: '示例校区 示例教室', notes: '请带电脑' });
    expect(result.courses[1]).toMatchObject({ name: '示例长课程名称', weeks: [9, 10, 11, 12, 13, 14, 15, 16], teacher: '乙老师', location: '另一教室' });
    expect(JSON.stringify(result)).not.toMatch(/虚构同学|不应导入|打印时间/);
  });

  it('uses column positions for interleaved glyphs and retains odd/even week rules', () => {
    const result = parsePdfLayout([page([...header,
      text('(1-2节)2-6周(双)/教师:乙老师', 214, 120),
      text('课程★', 128, 110, 9), text('第二课程★', 214, 110, 9), text('第一', 110, 110, 9),
      text('(3-4节)1-6周(单)/教师:甲老师', 110, 120),
    ])]);
    expect(result.courses.map(c => [c.name, c.day, c.weeks])).toEqual([['第一课程', 1, [1, 3, 5]], ['第二课程', 2, [2, 4, 6]]]);
  });

  it('reports an incomplete course instead of silently losing it', () => {
    const result = parsePdfLayout([page([...header, text('完整课程★', 110, 100, 9), text('(1-2节)1-8周/教师:甲', 110, 110), text('缺少时间★', 110, 150, 9), text('教师:乙', 110, 160)])]);
    expect(result.courses).toHaveLength(1);
    expect(result.warnings[0]).toContain('缺少时间');
    expect(result.sourceCount).toBe(2);
  });

  it('does not confuse vertically centered merged list labels with the first course baseline', () => {
    const result = parsePdfLayout([page([
      text('2026-2027学年第1学期', 21, 50),
      text('星期一', 24, 170, 12), text('7-8', 92, 140, 12),
      text('示例课程★', 154, 100, 9), text(detail('1-8周'), 356, 96),
      text('示例课程★', 154, 130, 9), text(detail('9-16周', '乙老师'), 356, 126),
      text('9-10', 92, 170, 12), text('另一课程★', 154, 170, 9), text(detail('2-16周(双)'), 356, 166),
      text('星期二', 24, 200, 12), text('1-2', 92, 200, 12), text('周二课程★', 154, 200, 9), text(detail('1-16周'), 356, 196),
    ])]);
    expect(result.warnings).toEqual([]);
    expect(result.courses.map(c => [c.name, c.day, c.periods])).toEqual([
      ['示例课程', 1, [7, 8]], ['示例课程', 1, [7, 8]], ['另一课程', 1, [9, 10]], ['周二课程', 2, [1, 2]],
    ]);
    expect(result.courses[1].teacher).toBe('乙老师');
    expect(result.courses[2].weeks).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });

  it('carries merged list context and course content across pages, including Sunday', () => {
    const result = parsePdfLayout([
      page([text('星期天', 24, 550, 12), text('12-13', 92, 550, 12), text('周日课程★', 154, 542, 9), text('周数:1-8周/校区:示例校区/地点:示例', 356, 538)]),
      page([text('教室/教师:甲老师/教学班:sample', 356, 25), text('另一课程★', 154, 65, 9), text(detail('9-16周'), 356, 61)]),
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.courses).toHaveLength(2);
    expect(result.courses.every(c => c.day === 7 && c.periods.join(',') === '12,13')).toBe(true);
    expect(result.courses[0].location).toBe('示例校区 示例教室');
  });

  it('accepts list names without an activity symbol and wrapped names', () => {
    const result = parsePdfLayout([page([
      text('星期一', 24, 100, 12), text('1-2', 92, 100, 12), text('线上课程', 154, 100, 9), text(detail('1-8周'), 356, 96),
      text('长名称', 154, 130, 9), text('的后半部分', 154, 139, 9), text(detail('9-16周'), 356, 126),
    ])]);
    expect(result.courses.map(c => c.name)).toEqual(['线上课程', '长名称的后半部分']);
  });

  it('rejects image-only or unrelated PDFs with a useful explanation', () => {
    expect(() => parsePdfLayout([page([])])).toThrow('扫描件或图片');
    expect(() => parsePdfLayout([page([text('这是一份通知，不是课程表', 10, 50)])])).toThrow('未识别出中财教务课表');
  });
});
