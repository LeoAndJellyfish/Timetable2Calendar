import type { Course, Occurrence, Settings } from './types';
import { compactNumbers, stableId } from './parser';

const DAY = 86400000;
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function validDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
}

export function dateWeekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7 + 1;
}

export function excludedDates(value: string): Set<string> {
  const dates = value.split(/[\s,，;；]+/).filter(Boolean);
  for (const date of dates) if (!validDate(date)) throw new Error(`停课日期「${date}」格式不正确，请使用 YYYY-MM-DD。`);
  return new Set(dates);
}

export function validateSettings(settings: Settings, courses: Course[] = []): string[] {
  const errors: string[] = [];
  if (!validDate(settings.firstMonday)) errors.push('请填写有效的第 1 周周一日期（2000–2099 年）。');
  else if (dateWeekday(settings.firstMonday) !== 1) errors.push('学期起始日期必须是第 1 周的周一。');
  if (!settings.calendarName.trim()) errors.push('请填写日历名称。');
  if (!['concise', 'detailed'].includes(settings.eventDetails)) errors.push('请选择简洁或详细的日历事件格式。');
  if (!Number.isInteger(settings.reminder) || settings.reminder < -1 || settings.reminder > 1440) errors.push('提醒时间需要在 0–1440 分钟之间，或选择不提醒。');
  if (!settings.periods.length || settings.periods.length > 24) errors.push('请配置 1–24 节作息时间。');
  let previousEnd = '';
  settings.periods.forEach((period, index) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(period.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.end)) {
      errors.push(`第 ${index + 1} 节时间不完整。`);
    } else if (period.start >= period.end) errors.push(`第 ${index + 1} 节结束时间须晚于开始时间。`);
    else if (previousEnd && period.start < previousEnd) errors.push(`第 ${index + 1} 节与前一节时间重叠。`);
    previousEnd = period.end;
  });
  const largestPeriod = Math.max(0, ...courses.flatMap(course => course.periods));
  if (largestPeriod > settings.periods.length) errors.push(`课表包含第 ${largestPeriod} 节，请先补全对应作息时间。`);
  try { excludedDates(settings.excludedDates); } catch (error) { errors.push((error as Error).message); }
  const sources = new Set<string>();
  for (const change of settings.changes) {
    if (!validDate(change.from) || !validDate(change.to)) errors.push('请填写完整、有效的调课日期，或移除空白调课规则。');
    else if (change.from === change.to) errors.push('调课的原日期和新日期不能相同。');
    if (sources.has(change.from)) errors.push(`${change.from} 有重复的调课规则。`);
    sources.add(change.from);
  }
  return [...new Set(errors)];
}

export function periodGroups(periods: number[]): number[][] {
  const groups: number[][] = [];
  for (const period of [...new Set(periods)].sort((a, b) => a - b)) {
    const last = groups.at(-1);
    if (last && last.at(-1)! + 1 === period) last.push(period);
    else groups.push([period]);
  }
  return groups;
}

export function expandCourses(courses: Course[], settings: Settings): Occurrence[] {
  const errors = validateSettings(settings, courses);
  if (errors.length) throw new Error(errors[0]);
  const excluded = excludedDates(settings.excludedDates);
  const moves = new Map(settings.changes.map(change => [change.from, change.to]));
  const events: Occurrence[] = [];
  for (const course of courses) {
    for (const week of course.weeks) {
      const originalDate = addDays(settings.firstMonday, (week - 1) * 7 + course.day - 1);
      // Simultaneous mapping, not chained: exchanges of teaching days work correctly.
      const date = moves.get(originalDate) || originalDate;
      if (excluded.has(date)) continue;
      for (const group of periodGroups(course.periods)) {
        const periodStart = group[0], periodEnd = group.at(-1)!;
        events.push({ course, week, date, originalDate, periodStart, periodEnd,
          start: settings.periods[periodStart - 1].start, end: settings.periods[periodEnd - 1].end,
          moved: date !== originalDate });
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.course.name.localeCompare(b.course.name));
}

export function findConflicts(events: Occurrence[]): [Occurrence, Occurrence][] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const conflicts: [Occurrence, Occurrence][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].date === sorted[i].date && sorted[j].start < sorted[i].end; j++) {
      conflicts.push([sorted[i], sorted[j]]);
      if (conflicts.length >= 100) return conflicts;
    }
  }
  return conflicts;
}

export function escapeIcs(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

export function foldLine(value: string): string {
  const encoder = new TextEncoder();
  let current = '', bytes = 0;
  const lines: string[] = [];
  for (const char of value) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += char; bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}

function utcStamp(date: Date): string { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function localStamp(date: string, time: string): string { return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`; }

/** Shared by the export preview and ICS writer so the displayed text matches the file. */
export function calendarEventText(event: Occurrence, mode: Settings['eventDetails']): { title: string; location: string; description: string } {
  const course = event.course;
  const periodText = compactNumbers(Array.from({ length: event.periodEnd - event.periodStart + 1 }, (_, index) => event.periodStart + index));
  const details = mode === 'detailed' ? [
    course.teacher && `教师：${course.teacher}`,
    `第 ${event.week} 周 · ${WEEKDAYS[course.day - 1]} · 第 ${periodText} 节`,
    course.className && `教学班：${course.className}`,
  ] : [course.teacher];
  return {
    title: course.name,
    // The imported campus remains available in the editor and detailed export.
    // Only remove a separate campus prefix; preserve classroom names and room spacing.
    location: mode === 'concise' ? course.location.trim().replace(/^\S+校区\s+(?=\S)/u, '') : course.location,
    description: [...details, mode === 'detailed' && course.notes,
      course.pending && '此课程在教务系统中标记为待筛选，请以最终选课结果为准。',
      event.moved && `调课：原 ${event.originalDate} → ${event.date}`,
    ].filter(Boolean).join('\n'),
  };
}

export function generateIcs(courses: Course[], settings: Settings, now = new Date()): { text: string; count: number } {
  if (!settings.timesConfirmed) throw new Error('请先在「学期与时间」核对开学日期和作息时间。');
  const events = expandCourses(courses, settings);
  if (!events.length) throw new Error('没有可导出的日程，请检查课程选择、周次和停课日期。');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Timetable2Calendar//CUFE//ZH-CN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(settings.calendarName)}`, 'X-WR-TIMEZONE:Asia/Shanghai', 'X-APPLE-CALENDAR-COLOR:#FF8D28',
    // All supported academic dates are 2000 or later, when Shanghai is UTC+08:00 without DST.
    'BEGIN:VTIMEZONE', 'TZID:Asia/Shanghai', 'X-LIC-LOCATION:Asia/Shanghai',
    'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST',
    'END:STANDARD', 'END:VTIMEZONE'];
  const stamp = utcStamp(now);
  for (const event of events) {
    const course = event.course;
    const identity = JSON.stringify([course.className || course.name, course.name, course.day, event.periodStart, event.periodEnd, event.originalDate, course.teacher, course.location]);
    const display = calendarEventText(event, settings.eventDetails);
    lines.push('BEGIN:VEVENT', `UID:${stableId(identity)}@timetable2calendar.local`, `DTSTAMP:${stamp}`, `CREATED:${stamp}`, `LAST-MODIFIED:${stamp}`, 'SEQUENCE:0',
      `DTSTART;TZID=Asia/Shanghai:${localStamp(event.date, event.start)}`,
      `DTEND;TZID=Asia/Shanghai:${localStamp(event.date, event.end)}`,
      `SUMMARY:${escapeIcs(display.title)}`, `LOCATION:${escapeIcs(display.location)}`,
      `DESCRIPTION:${escapeIcs(display.description)}`, `STATUS:${course.pending ? 'TENTATIVE' : 'CONFIRMED'}`, 'TRANSP:OPAQUE');
    if (settings.reminder >= 0) lines.push('BEGIN:VALARM', `TRIGGER:-PT${settings.reminder}M`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(course.name)}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(foldLine).join('\r\n') + '\r\n', count: events.length };
}
