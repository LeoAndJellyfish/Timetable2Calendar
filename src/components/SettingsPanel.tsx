import { CalendarDays, Clock3, Plus, Trash2, ArrowRight, Check, Info } from 'lucide-react';
import type { Course, Settings } from '../lib/types';
import { validateSettings } from '../lib/calendar';
import { initialSettings } from '../lib/settings';

export function SettingsPanel({ settings, setSettings, section, courses, onDone }: { settings: Settings; setSettings: (settings: Settings) => void; section: 'settings' | 'exceptions'; courses: Course[]; onDone: () => void }) {
  const errors = validateSettings(settings, courses);
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings({ ...settings, [key]: value, ...(['firstMonday', 'periods'].includes(key) ? { timesConfirmed: false } : {}) });
  }
  if (section === 'exceptions') return <section className="panel settings-panel">
    <div className="section-heading"><div><div className="panel-eyebrow">03 / ADJUSTMENTS</div><h2>调整上课日期</h2></div><CalendarDays size={24} /></div>
    <div className="notice neutral"><Info size={19} /><div><strong>按学校通知手动调整</strong><p>普通周次会照常排课。这里添加的规则作用于所有选中的课程，预览和导出会同步更新。</p></div></div>
    <label className="field-label">整日停课日期<textarea rows={3} placeholder={'例如：2026-10-01\n2026-10-02'} value={settings.excludedDates} onInput={event => update('excludedDates', event.currentTarget.value)} /><small>每行一个日期，也可用逗号分隔。这些日期上的课程将不导出。</small></label>
    <div className="subheading"><h3>整日调课</h3><button className="button secondary compact" onClick={() => update('changes', [...settings.changes, { id: crypto.randomUUID(), from: '', to: '' }])}><Plus size={15} />添加规则</button></div>
    <p className="muted">将原日期的课程移到新日期，保持原来的节次。原日期不再上这些课；新日期已有课程会保留。</p>
    {settings.changes.length === 0 && <div className="small-empty">还没有调课规则，课程按原周次安排。</div>}
    {settings.changes.map((change, index) => <div className="change-row" key={change.id}>
      <label>原上课日期<input type="date" aria-label={`调课 ${index + 1} 原日期`} value={change.from} onInput={event => update('changes', settings.changes.map(item => item.id === change.id ? { ...item, from: event.currentTarget.value } : item))} /></label><ArrowRight size={19} />
      <label>移到新日期<input type="date" aria-label={`调课 ${index + 1} 新日期`} value={change.to} onInput={event => update('changes', settings.changes.map(item => item.id === change.id ? { ...item, to: event.currentTarget.value } : item))} /></label>
      <button className="icon-button" aria-label={`移除调课 ${index + 1}`} onClick={() => update('changes', settings.changes.filter(item => item.id !== change.id))}><Trash2 size={18} /></button>
    </div>)}
    <p className="muted footnote">规则同时生效，不会连续转移。若新日期也被设置为停课，移过去的课程同样不导出。</p>
    <Errors errors={errors} />
    <div className="dialog-actions"><button className="button primary" disabled={errors.length > 0} onClick={onDone}>查看调整后的课表<ArrowRight size={16} /></button></div>
  </section>;

  return <section className="panel settings-panel">
    <div className="section-heading"><div><div className="panel-eyebrow">02 / SEMESTER</div><h2>学期设置</h2></div><Clock3 size={24} /></div>
    <div className="settings-intro"><CalendarDays size={20} /><p>用「第 1 周周一」作为起点，把课表周次换算为具体日期。</p></div>
    <div className="form-grid">
      <label className="field-label">第 1 周周一<input type="date" min="2000-01-01" max="2099-12-31" value={settings.firstMonday} onInput={event => update('firstMonday', event.currentTarget.value)} /><small>按你的学期校历设置，不一定是第一天有课的日期。</small></label>
      <label className="field-label">日历名称<input maxLength={100} value={settings.calendarName} onInput={event => update('calendarName', event.currentTarget.value)} /></label>
    </div>
    <div className="form-grid">
      <label className="field-label">课前提醒<select value={settings.reminder} onChange={event => update('reminder', Number(event.currentTarget.value))}><option value={-1}>不提醒</option><option value={0}>上课时</option><option value={5}>提前 5 分钟</option><option value={10}>提前 10 分钟</option><option value={15}>提前 15 分钟</option><option value={30}>提前 30 分钟</option><option value={60}>提前 1 小时</option></select></label>
      <label className="field-label">时区<div className="static-input">中国标准时间 · UTC+08:00</div><small>日历文件注明 Asia/Shanghai 时区；客户端会按你的日历时区显示。</small></label>
    </div>
    <label className="field-label calendar-format-field">日历事件格式<select value={settings.eventDetails} onChange={event => update('eventDetails', event.currentTarget.value as Settings['eventDetails'])}><option value="concise">简洁：课程名 / 教室 / 教师</option><option value="detailed">详细：附周次、节次和教学班</option></select><small>简洁格式把教师放在备注中、地点只保留教室。课程备注在详细格式中显示；调课和待筛选提示始终保留。</small></label>
    <div className="subheading"><h3>每天的作息时间</h3><button className="text-button" onClick={() => update('periods', initialSettings().periods)}>恢复中财默认</button></div>
    <p className="muted">默认来自《关于调整学校教学作息时间的通知》（校发〔2019〕5 号），每节 45 分钟，可逐项调整。</p>
    <div className="periods-grid">{settings.periods.map((period, index) => <div className="period-row" key={index}><span>{String(index + 1).padStart(2, '0')}</span><input aria-label={`第 ${index + 1} 节开始`} type="time" value={period.start} onInput={event => update('periods', settings.periods.map((item, i) => i === index ? { ...item, start: event.currentTarget.value } : item))} /><span className="time-dash">—</span><input aria-label={`第 ${index + 1} 节结束`} type="time" value={period.end} onInput={event => update('periods', settings.periods.map((item, i) => i === index ? { ...item, end: event.currentTarget.value } : item))} /></div>)}</div>
    <div className="button-row"><button className="text-button" disabled={settings.periods.length >= 24} onClick={() => update('periods', [...settings.periods, { start: '', end: '' }])}><Plus size={15} />添加节次</button>{settings.periods.length > 13 && <button className="text-button" onClick={() => update('periods', settings.periods.slice(0, -1))}>移除最后一节</button>}</div>
    <Errors errors={errors} />
    <label className="confirm-times"><input type="checkbox" checked={settings.timesConfirmed} disabled={errors.length > 0} onChange={event => update('timesConfirmed', event.currentTarget.checked)} /><span>已核对本学期第 1 周日期和作息时间</span></label>
    <div className="dialog-actions"><button className="button primary" disabled={errors.length > 0 || !settings.timesConfirmed} onClick={onDone}><Check size={16} />保存并查看课表</button></div>
  </section>;
}

function Errors({ errors }: { errors: string[] }) {
  return errors.length ? <div className="error-message" role="alert">{errors.slice(0, 5).map(error => <p key={error}>{error}</p>)}{errors.length > 5 && <p>另有 {errors.length - 5} 项时间需要补全。</p>}</div> : null;
}
