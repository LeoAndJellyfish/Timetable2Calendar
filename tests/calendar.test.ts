import { describe, expect, it } from 'vitest';
import ICAL from 'ical.js';
import { calendarEventText, expandCourses, generateIcs, foldLine, validDate, validateSettings, findConflicts } from '../src/lib/calendar';
import { initialSettings } from '../src/lib/settings';
import { demoResult } from './fixtures/schedule';
import type { Course } from '../src/lib/types';

const base: Course = { ...demoResult().courses[0], name: '测试课程', weeks: [1, 3, 5], weekText: '1,3,5周' };
const ready = () => ({ ...initialSettings(), timesConfirmed: true });

describe('academic dates and adjustments', () => {
  it('uses configurable first Monday and exact weeks', () => {
    const events = expandCourses([base], { ...ready(), firstMonday: '2026-09-14' });
    expect(events.map(event => event.date)).toEqual(['2026-09-14', '2026-09-28', '2026-10-12']);
    expect(events[0]).toMatchObject({ start: '08:00', end: '09:40' });
  });
  it('correctly crosses month/year boundaries for Sunday courses', () => {
    const events = expandCourses([{ ...base, day: 7, weeks: [1, 2] }], { ...ready(), firstMonday: '2026-12-28' });
    expect(events.map(event => event.date)).toEqual(['2027-01-03', '2027-01-10']);
  });
  it('splits nonconsecutive periods into separate events', () => {
    const events = expandCourses([{ ...base, periods: [1, 2, 7, 8], weeks: [1] }], ready());
    expect(events.map(({ start, end }) => [start, end])).toEqual([['08:00', '09:40'], ['14:00', '15:40']]);
  });
  it('moves lessons off excluded original dates and excludes destination dates', () => {
    const settings = { ...ready(), excludedDates: '2026-09-07,2026-09-21', changes: [{ id: 'move', from: '2026-09-07', to: '2026-09-12' }] };
    expect(expandCourses([base], settings).map(event => event.date)).toEqual(['2026-09-12', '2026-10-05']);
    settings.excludedDates += ',2026-09-12';
    expect(expandCourses([base], settings)).toHaveLength(1);
  });
  it('exchanges days simultaneously instead of recursively applying rules', () => {
    const settings = { ...ready(), changes: [{ id: 'a', from: '2026-09-07', to: '2026-09-08' }, { id: 'b', from: '2026-09-08', to: '2026-09-07' }] };
    const events = expandCourses([{ ...base, weeks: [1] }, { ...base, id: 'b', day: 2, weeks: [1] }], settings);
    expect(events.map(event => [event.originalDate, event.date])).toEqual([['2026-09-08', '2026-09-07'], ['2026-09-07', '2026-09-08']]);
  });
  it('requires a real Monday, complete times, and unique date rules', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validateSettings({ ...ready(), firstMonday: '2026-09-08' })).toContain('学期起始日期必须是第 1 周的周一。');
    expect(() => expandCourses([base], { ...ready(), periods: [{ start: '10:00', end: '09:00' }] })).toThrow();
    expect(() => expandCourses([base], { ...ready(), excludedDates: 'bad' })).toThrow();
    expect(validateSettings({ ...ready(), changes: [{ id: 'a', from: '2026-09-07', to: '2026-09-08' }, { id: 'b', from: '2026-09-07', to: '2026-09-09' }] }).some(error => error.includes('重复'))).toBe(true);
  });
  it('finds overlapping courses but permits adjacent periods and separate weeks', () => {
    const events = expandCourses([base, { ...base, id: 'overlap', periods: [2, 3] }, { ...base, id: 'later', periods: [7, 8] }], ready());
    expect(findConflicts(events)).toHaveLength(3);
  });
  it('uses all 13 times from user-provided school document', () => {
    const settings = ready();
    expect(settings.periods[5]).toEqual({ start: '12:45', end: '13:30' });
    expect(settings.periods[6]).toEqual({ start: '14:00', end: '14:45' });
    expect(settings.periods[12]).toEqual({ start: '20:15', end: '21:00' });
  });
});

describe('RFC 5545 export, independently read by ical.js', () => {
  it('exports Shanghai local times with a timezone definition and correct UTC date rollover', () => {
    const settings = { ...ready(), reminder: 10 }; settings.periods[0] = { start: '07:00', end: '07:45' };
    const { text, count } = generateIcs([{ ...base, weeks: [1], periods: [1] }], settings);
    const component = new ICAL.Component(ICAL.parse(text));
    const event = new ICAL.Event(component.getFirstSubcomponent('vevent')!);
    expect(count).toBe(1);
    expect(component.getAllSubcomponents('vtimezone')).toHaveLength(1);
    expect(event.startDate.zone.tzid).toBe('Asia/Shanghai');
    expect(event.startDate.toString()).toBe('2026-09-07T07:00:00');
    expect(event.startDate.convertToZone(ICAL.Timezone.utcTimezone).toString()).toBe('2026-09-06T23:00:00Z');
    expect(event.endDate.convertToZone(ICAL.Timezone.utcTimezone).toString()).toBe('2026-09-06T23:45:00Z');
    expect(component.getFirstSubcomponent('vevent')!.getFirstSubcomponent('valarm')!.getFirstPropertyValue('trigger')!.toString()).toBe('-PT10M');
  });
  it('round-trips Chinese, punctuation, emojis and malicious newline text safely', () => {
    const name = '数据,分析;专题\\研究🌿'.repeat(10);
    const note = '第一行\n第二行\r\nEND:VEVENT\r\nBEGIN:VEVENT';
    const { text } = generateIcs([{ ...base, name, notes: note, weeks: [1] }], { ...ready(), eventDetails: 'detailed' });
    const component = new ICAL.Component(ICAL.parse(text));
    expect(component.getAllSubcomponents('vevent')).toHaveLength(1);
    const event = new ICAL.Event(component.getFirstSubcomponent('vevent')!);
    expect(event.summary).toBe(name);
    expect(event.description).toContain('第一行\n第二行\nEND:VEVENT');
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it('has deterministic UIDs on repeated export', () => {
    const first = generateIcs([base], ready(), new Date('2026-09-01T00:00:00Z'));
    const second = generateIcs([base], ready(), new Date('2026-09-02T00:00:00Z'));
    expect(first.text.match(/UID:.+/g)).toEqual(second.text.match(/UID:.+/g));
    expect(new Set(first.text.match(/UID:.+/g)).size).toBe(3);
  });
  it('keeps split teachers confined to their correct weeks', () => {
    const courses = demoResult().courses.filter(course => course.name === '人工智能导论');
    const component = new ICAL.Component(ICAL.parse(generateIcs(courses, ready()).text));
    const items = component.getAllSubcomponents('vevent').map(item => new ICAL.Event(item));
    expect(items).toHaveLength(16);
    expect(items[7].description).toContain('王老师');
    expect(items[8].description).toContain('李老师');
  });
  it('omits alarms when disabled and refuses unverified or empty exports', () => {
    expect(generateIcs([base], { ...ready(), reminder: -1 }).text).not.toContain('VALARM');
    expect(() => generateIcs([base], initialSettings())).toThrow('核对');
    expect(() => generateIcs([], ready())).toThrow('没有可导出');
  });
  it('folding never splits Unicode code points', () => {
    const original = 'SUMMARY:' + '中🌿'.repeat(100);
    const folded = foldLine(original);
    expect(folded.replace(/\r\n /g, '')).toBe(original);
    expect(folded).not.toContain('\uFFFD');
  });

  it('defaults to the reference layout: course title, room location, teacher description, no alarm or recurrence', () => {
    const course = { ...base, teacher: '陈老师', location: '沙河校区 示例教学楼 A201', notes: '', weeks: [1] };
    const { text } = generateIcs([course], ready());
    const component = new ICAL.Component(ICAL.parse(text));
    const item = component.getFirstSubcomponent('vevent')!;
    const event = new ICAL.Event(item);
    expect(event.summary).toBe('测试课程');
    expect(event.location).toBe('示例教学楼 A201');
    expect(event.description).toBe('陈老师');
    expect(item.getFirstSubcomponent('valarm')).toBeNull();
    expect(item.getFirstProperty('rrule')).toBeNull();
    expect(item.getFirstPropertyValue('sequence')).toBe(0);
    expect(component.getFirstPropertyValue('x-apple-calendar-color')).toBe('#FF8D28');
    expect(item.getFirstProperty('created')).not.toBeNull();
    expect(item.getFirstProperty('last-modified')).not.toBeNull();
    expect(course.location).toBe('沙河校区 示例教学楼 A201');
    expect(text).not.toContain('x-apple-creator-identity');
  });

  it('keeps pending status and date adjustments in concise descriptions, with course notes available in detailed format', () => {
    const course = { ...base, teacher: '甲老师', weeks: [1], pending: true, notes: '请带电脑' };
    const settings = { ...ready(), changes: [{ id: 'a', from: '2026-09-07', to: '2026-09-12' }] };
    const event = new ICAL.Event(new ICAL.Component(ICAL.parse(generateIcs([course], settings).text)).getFirstSubcomponent('vevent')!);
    expect(event.description).toMatch(/^甲老师\n/);
    expect(event.description).not.toContain('请带电脑');
    expect(event.description).toContain('待筛选');
    expect(event.description).toContain('调课：原 2026-09-07 → 2026-09-12');
    expect(event.component.getFirstPropertyValue('status')).toBe('TENTATIVE');
    expect(event.startDate.toString()).toBe('2026-09-12T08:00:00');
    expect(calendarEventText(expandCourses([course], settings)[0], 'detailed').description).toContain('请带电脑');
  });

  it('detailed formatting keeps the full location and describes each nonconsecutive period group correctly', () => {
    const course = { ...base, teacher: '甲老师', location: '沙河校区 示例教室', periods: [1, 2, 7, 8], weeks: [1] };
    const settings = { ...ready(), eventDetails: 'detailed' as const };
    const events = expandCourses([course], settings);
    expect(calendarEventText(events[0], settings.eventDetails)).toMatchObject({ location: course.location, description: expect.stringContaining('第 1–2 节') });
    expect(calendarEventText(events[1], settings.eventDetails).description).toContain('第 7–8 节');
    expect(calendarEventText(events[0], settings.eventDetails).description).toContain(`教学班：${course.className}`);
    const conciseUids = generateIcs([course], ready()).text.match(/UID:.+/g);
    expect(generateIcs([course], settings).text.match(/UID:.+/g)).toEqual(conciseUids);
  });

  it('does not remove room spacing or a campus-only location in concise format', () => {
    for (const location of ['示例楼 A201', '沙河校区', 'North Campus Room 201', '']) {
      const event = expandCourses([{ ...base, location, weeks: [1] }], ready())[0];
      expect(calendarEventText(event, 'concise').location).toBe(location);
    }
  });

  it.each([0.25, 2, 0, undefined])('includes known credits only in detailed ICS descriptions and preserves UIDs: %s', credits => {
    const course = { ...base, credits, weeks: [1] };
    const settings = { ...ready(), eventDetails: 'detailed' as const };
    const occurrence = expandCourses([course], settings)[0];
    const detailed = new ICAL.Event(new ICAL.Component(ICAL.parse(generateIcs([course], settings).text)).getFirstSubcomponent('vevent')!);
    expect(detailed.description).toBe(calendarEventText(occurrence, 'detailed').description);
    if (credits === undefined) expect(detailed.description).not.toContain('学分：');
    else expect(detailed.description.split('\n')).toContain(`学分：${credits}`);
    const concise = new ICAL.Event(new ICAL.Component(ICAL.parse(generateIcs([course], ready()).text)).getFirstSubcomponent('vevent')!);
    expect(concise.description).toBe(course.teacher);
    expect(detailed.uid).toBe(concise.uid);
    const withoutCredits = generateIcs([{ ...course, credits: undefined }], settings);
    expect(withoutCredits.text.match(/UID:.+/g)).toEqual(generateIcs([course], settings).text.match(/UID:.+/g));
  });
});
