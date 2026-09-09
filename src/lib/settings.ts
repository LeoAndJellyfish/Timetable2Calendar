import type { Course, Settings } from './types';

// CUFE 校发〔2019〕5号, supplied by the user and visually checked on 2026-09-07.
export function initialSettings(): Settings {
  return {
    firstMonday: '2026-09-07', calendarName: '我的学期课表', reminder: -1, eventDetails: 'concise',
    periods: [
      ['08:00', '08:45'], ['08:55', '09:40'], ['10:00', '10:45'], ['10:55', '11:40'], ['11:50', '12:35'],
      ['12:45', '13:30'], ['14:00', '14:45'], ['14:55', '15:40'], ['16:00', '16:45'], ['16:55', '17:40'],
      ['17:50', '18:35'], ['19:20', '20:05'], ['20:15', '21:00'],
    ].map(([start, end]) => ({ start, end })),
    excludedDates: '', changes: [], timesConfirmed: false,
  };
}

export function coursePayload(courses: Course[], term: string) {
  return { format: 'timetable2calendar', version: 1, source: 'cufe-zhengfang', term,
    records: courses.map(course => ({
      name: course.name, day: course.day, time: `(${course.periods.join(',')}节)${course.weeks.join(',')}周`,
      location: course.location, teacher: course.teacher, className: course.className, notes: course.notes, pending: course.pending,
      ...(course.credits !== undefined ? { credits: course.credits } : {}),
    })) };
}
