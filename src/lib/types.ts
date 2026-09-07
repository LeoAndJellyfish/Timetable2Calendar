export interface Course {
  id: string;
  name: string;
  day: number;
  periods: number[];
  weeks: number[];
  weekText: string;
  teacher: string;
  location: string;
  className: string;
  notes: string;
  pending: boolean;
}

export interface ImportResult {
  courses: Course[];
  term: string;
  warnings: string[];
  sourceCount: number;
}

export interface Period { start: string; end: string }
export interface DateChange { id: string; from: string; to: string }
export interface Settings {
  firstMonday: string;
  calendarName: string;
  reminder: number;
  eventDetails: 'concise' | 'detailed';
  periods: Period[];
  excludedDates: string;
  changes: DateChange[];
  timesConfirmed: boolean;
}

export interface Occurrence {
  course: Course;
  week: number;
  date: string;
  originalDate: string;
  start: string;
  end: string;
  periodStart: number;
  periodEnd: number;
  moved: boolean;
}
