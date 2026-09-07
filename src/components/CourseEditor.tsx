import { useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog } from './Dialog';
import type { Course } from '../lib/types';
import { compactNumbers, parsePeriods, parseWeeks } from '../lib/parser';
import { WEEKDAYS } from '../lib/calendar';

export function CourseEditor({ course, onSave, onClose }: { course: Course; onSave: (course: Course) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(course);
  const [periods, setPeriods] = useState(compactNumbers(course.periods));
  const [weeks, setWeeks] = useState(course.weekText);
  const [error, setError] = useState('');
  function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!draft.name.trim()) throw new Error('请填写课程名称。');
      onSave({ ...draft, name: draft.name.trim(), periods: parsePeriods(periods), weeks: parseWeeks(weeks), weekText: weeks });
      onClose();
    } catch (err) { setError((err as Error).message); }
  }
  return <Dialog title="核对课程" onClose={onClose}>
    <p className="muted">每条记录对应一个授课段；不同周段可以有不同教师和教室。</p>
    <form onSubmit={save} className="edit-form">
      <label>课程名称<input required maxLength={200} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <div className="form-grid"><label>星期<select value={draft.day} onChange={event => setDraft({ ...draft, day: Number(event.target.value) })}>{WEEKDAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label><label>节次<input required value={periods} onChange={event => setPeriods(event.target.value)} placeholder="例如 1-2" /></label></div>
      <label>上课周次<input required value={weeks} onChange={event => setWeeks(event.target.value)} placeholder="例如 1-8周,10-16周(单)" /><small>支持单双周、不连续周次，例如 1-8周、10-16周(单)。</small></label>
      <div className="form-grid"><label>教师<input maxLength={1000} value={draft.teacher} onChange={event => setDraft({ ...draft, teacher: event.target.value })} /></label><label>教室 / 地点<input maxLength={1000} value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></label></div>
      <label>备注<textarea maxLength={1000} rows={2} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      {draft.pending && <p className="notice warning">此课程在教务系统中为待筛选状态。</p>}
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" type="submit"><Check size={17} />保存修改</button></div>
    </form>
  </Dialog>;
}
