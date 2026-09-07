import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List, Search, SlidersHorizontal, Pencil, CircleCheck, CalendarX2 } from 'lucide-react';
import type { Course, Occurrence, Settings } from '../lib/types';
import { addDays, dateWeekday, WEEKDAYS, validDate } from '../lib/calendar';
import { compactNumbers, stableId } from '../lib/parser';

export function Timetable({ courses, selected, toggle, events, settings, week, setWeek, onEdit, onSettings, maxWeek, term }: { courses: Course[]; selected: Set<string>; toggle: (id: string) => void; events: Occurrence[]; settings: Settings; week: number; setWeek: (week: number) => void; onEdit: (course: Course) => void; onSettings: () => void; maxWeek: number; term: string }) {
  const [view, setView] = useState<'week' | 'list'>('week');
  const [query, setQuery] = useState('');
  const hasDate = validDate(settings.firstMonday) && dateWeekday(settings.firstMonday) === 1;
  const start = hasDate ? addDays(settings.firstMonday, (week - 1) * 7) : '';
  const end = start ? addDays(start, 6) : '';
  const weekEvents = events.filter(event => event.date >= start && event.date <= end);
  const color = (course: Course) => Number.parseInt(stableId(course.className || course.name).slice(0, 6), 16) % 6;
  const filtered = courses.filter(course => [course.name, course.teacher, course.location].some(text => text.includes(query.trim())));

  return <section className="panel timetable-panel">
    <div className="timetable-heading"><div><h2>课表预览 <span className="badge success">已导入</span></h2><p>{term || '我的学期课表'}</p></div><div className="view-switch" role="group" aria-label="课表显示方式"><button title="周视图" aria-label="周视图" aria-pressed={view === 'week'} onClick={() => setView('week')}><CalendarDays size={15} /><span>周课表</span></button><button title="课程列表" aria-label="课程列表" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} /><span>课程列表</span></button></div></div>
    <div className="timetable-toolbar"><div className="week-control"><button className="icon-button" aria-label="上一周" disabled={week <= 1} onClick={() => setWeek(week - 1)}><ChevronLeft size={17} /></button><select aria-label="预览周次" value={week} onChange={event => setWeek(Number(event.target.value))}>{Array.from({ length: maxWeek }, (_, index) => <option value={index + 1} key={index}>第 {index + 1} 周</option>)}</select><button className="icon-button" aria-label="下一周" disabled={week >= maxWeek} onClick={() => setWeek(week + 1)}><ChevronRight size={17} /></button></div><span className="date-range">{start ? `${start.slice(5).replace('-', '.')} — ${end.slice(5).replace('-', '.')}` : '请设置开学日期'}</span><button className="text-button time-settings" onClick={onSettings}><SlidersHorizontal size={15} />时间设置</button></div>
    {view === 'week' ? <>
      <div className="calendar-scroll">
        <div className="calendar-grid" style={{ gridTemplateRows: `56px repeat(${settings.periods.length}, var(--period-height))` }} role="region" aria-label={`第 ${week} 周课程表`}>
          <div className="calendar-corner" style={{ gridColumn: 1, gridRow: 1 }}>节次</div>
          {WEEKDAYS.map((day, index) => <div className={`day-heading ${index > 4 ? 'weekend' : ''}`} style={{ gridColumn: index + 2, gridRow: 1 }} key={day}><span>{day}</span><small>{start ? addDays(start, index).slice(5).replace('-', '/') : '—'}</small></div>)}
          {settings.periods.map((period, index) => <div className="period-label" style={{ gridColumn: 1, gridRow: index + 2 }} key={index}><strong>{String(index + 1).padStart(2, '0')}</strong><small>{period.start}</small></div>)}
          {WEEKDAYS.flatMap((_, day) => settings.periods.map((_, period) => <div className={`calendar-cell ${day > 4 ? 'weekend' : ''}`} style={{ gridColumn: day + 2, gridRow: period + 2 }} key={`${day}-${period}`} />))}
          {weekEvents.map((event, index) => {
            const overlap = weekEvents.filter(other => other !== event && other.date === event.date && other.periodStart <= event.periodEnd && other.periodEnd >= event.periodStart);
            return <button key={`${event.course.id}-${event.date}-${index}`} className={`course-block color-${color(event.course)} ${overlap.length ? 'has-conflict' : ''} ${event.periodStart === event.periodEnd ? 'short-course' : ''}`} style={{ gridColumn: dateWeekday(event.date) + 1, gridRow: `${event.periodStart + 1} / span ${event.periodEnd - event.periodStart + 1}`, ...(overlap.length ? { marginLeft: `${index % 2 === 0 ? 3 : 18}px`, marginRight: `${index % 2 === 0 ? 18 : 3}px` } : {}) }} onClick={() => onEdit(event.course)} title={`${event.course.name}\n${event.date} ${event.start}–${event.end}\n${event.course.teacher} · ${event.course.location}${overlap.length ? '\n时间冲突，请切换列表核对' : ''}`}>
              <strong>{event.course.name}</strong><span>{event.course.location}</span><small>{event.course.teacher}{event.moved ? ' · 调课' : ''}</small>{overlap.length > 0 && <b>时间冲突</b>}
            </button>;
          })}
          {weekEvents.length === 0 && <div className="calendar-empty"><CalendarX2 size={27} /><strong>这一周没有安排课程</strong><span>切换周次，或检查导入与课程选择。</span></div>}
        </div>
      </div>
      <div className="timetable-footer"><span><i className="green-dot" />本周 {weekEvents.length} 次课</span><span>点击课程可查看和修改</span><button className="text-button" onClick={() => setView('list')}>选择导出课程<List size={14} /></button></div>
    </> : <div className="course-list-view">
      <label className="search-field"><Search size={16} /><input aria-label="搜索课程" placeholder="搜索课程、教师或教室" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="list-caption"><span>已选 {selected.size} / {courses.length} 个排课段</span><span>列表显示整个学期的课程</span></div>
      <div className="course-list">{filtered.map(course => <div className="course-list-row" key={course.id}><input type="checkbox" aria-label={`导出 ${course.name} ${course.weekText}`} checked={selected.has(course.id)} onChange={() => toggle(course.id)} /><i className={`course-color color-${color(course)}`} /><button className="course-list-main" onClick={() => onEdit(course)}><strong>{course.name}{course.pending && <span className="badge pending">待筛选</span>}</strong><span>{WEEKDAYS[course.day - 1]} · {compactNumbers(course.periods)} 节 · {course.weekText}</span><small>{course.teacher || '教师未填写'} · {course.location || '地点未填写'}</small></button><button className="icon-button" aria-label={`编辑 ${course.name} ${course.weekText}`} onClick={() => onEdit(course)}><Pencil size={15} /></button></div>)}{!filtered.length && <div className="small-empty">没有匹配的课程</div>}</div>
      <div className="list-note"><CircleCheck size={16} />仅勾选的课程会出现在预览和导出的日历中。</div>
    </div>}
  </section>;
}
