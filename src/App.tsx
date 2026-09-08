import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, CalendarCheck2, Check, CheckCheck, ChevronRight, CircleHelp, Download, FileJson, Trash2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { ImportPanel } from './components/ImportPanel';
import { Timetable } from './components/Timetable';
import { SettingsPanel } from './components/SettingsPanel';
import { CourseEditor } from './components/CourseEditor';
import { Guide } from './components/Guide';
import { Dialog } from './components/Dialog';
import { coursePayload, initialSettings } from './lib/settings';
import { calendarEventText, expandCourses, findConflicts, generateIcs, validateSettings, validDate } from './lib/calendar';
import { downloadText } from './lib/download';
import type { Course, ImportResult, Settings } from './lib/types';

type Section = 'timetable' | 'settings' | 'exceptions';
const SECTION_NAMES = { timetable: '我的课表', settings: '学期与时间', exceptions: '停课与调课' };
const emptyResult = (): ImportResult => ({ courses: [], term: '', warnings: [], sourceCount: 0 });
const PAGE_COPY = {
  settings: { eyebrow: 'SEMESTER & TIME', title: '学期与时间', description: '从第一周开始，让每一节课都准时出现在日历里。' },
  exceptions: { eyebrow: 'SCHEDULE ADJUSTMENTS', title: '停课与调课', description: '为假期和临时变动，留一点调整的空间。' },
};

export default function App() {
  const [result, setResult] = useState<ImportResult>(emptyResult);
  const hasCourses = result.courses.length > 0;
  const [filename, setFilename] = useState('');
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(result.courses.map(course => course.id)));
  const [section, setSection] = useState<Section>('timetable');
  const [week, setWeek] = useState(1);
  const [guide, setGuide] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [section, hasCourses]);
  const selectedCourses = useMemo(() => result.courses.filter(course => selected.has(course.id)), [result, selected]);
  const errors = useMemo(() => validateSettings(settings, selectedCourses), [settings, selectedCourses]);
  const events = useMemo(() => errors.length ? [] : expandCourses(selectedCourses, settings), [errors, selectedCourses, settings]);
  const conflicts = useMemo(() => findConflicts(events), [events]);
  const distinct = new Set(selectedCourses.map(course => course.className || course.name)).size;
  const courseMaxWeek = Math.max(1, ...result.courses.flatMap(course => course.weeks));
  const latestDate = events.at(-1)?.date;
  const movedMaxWeek = latestDate && validDate(settings.firstMonday) ? Math.floor((Date.parse(latestDate) - Date.parse(settings.firstMonday)) / 604800000) + 1 : 1;
  const maxWeek = Math.max(courseMaxWeek, Math.min(106, movedMaxWeek));
  const pendingCount = result.courses.filter(course => course.pending).length;
  const exportPreview = events[0] && calendarEventText(events[0], settings.eventDetails);

  function importResult(next: ImportResult, name: string) {
    setResult(next); setSelected(new Set(next.courses.filter(course => !course.pending).map(course => course.id)));
    setFilename(name); setWeek(1); setSection('timetable');
    setSettings(current => ({ ...current, timesConfirmed: false, excludedDates: '', changes: [] }));
    setToast(`已导入 ${next.courses.length} 个排课段${next.warnings.length ? `，${next.warnings.length} 条提示待核对` : ''}`);
  }
  function toggle(id: string) { setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function requestExport() {
    if (!selectedCourses.length) { setToast('请先在课程列表中选择要导出的课程。'); return; }
    if (errors.length || !settings.timesConfirmed) { setSection('settings'); setToast(errors[0] || '先核对第 1 周日期和作息时间，就可以导出。'); return; }
    if (!events.length) { setToast('当前没有可导出的日程，请检查停课日期和课程选择。'); return; }
    setDownloaded(false); setExportOpen(true);
  }
  function download() {
    try {
      const file = generateIcs(selectedCourses, settings);
      downloadText(file.text, `${settings.calendarName}.ics`, 'text/calendar;charset=utf-8');
      setDownloaded(true);
    } catch (error) { setToast((error as Error).message); }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className={`product-nav ${hasCourses ? '' : 'product-nav-empty'}`}>
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setSection('timetable'); }} aria-label="课历首页"><span className="brand-mark" aria-hidden="true"><CalendarCheck2 size={22} strokeWidth={1.8} /></span><span>课历</span></a>
      {hasCourses && <nav aria-label="主导航">
        {(['timetable', 'settings', 'exceptions'] as const).map(key => <button key={key} className={`nav-item ${section === key ? 'active' : ''}`} onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined}>{SECTION_NAMES[key]}</button>)}
      </nav>}
      <div className="product-nav-actions"><button className="button secondary guide-button" onClick={() => setGuide(true)}><CircleHelp size={15} /><span>使用指南</span></button></div>
    </header>

    <main id="main-content" className={`main-content page-${section} ${hasCourses ? '' : 'page-empty'}`} tabIndex={-1}>
      {section === 'timetable' && (hasCourses ? <h1 className="visually-hidden">我的课表</h1> : <section className="home-intro" aria-labelledby="home-title">
        <h1 id="home-title">把课表转换为日历</h1>
        <p>导入教务课表，核对上课时间，导出 .ics 文件。可添加到 Apple 日历、Google 日历或 Outlook。</p>
      </section>)}
      {(section !== 'timetable' || hasCourses) && <section className={`hero ${section === 'timetable' ? 'hero-actions' : ''}`}>
        {section !== 'timetable' && <div className="hero-copy"><div className="eyebrow">{PAGE_COPY[section].eyebrow}</div><h1>{PAGE_COPY[section].title}</h1><p>{PAGE_COPY[section].description}</p></div>}
        {hasCourses && <button className="button primary export-main" onClick={requestExport}><ArrowDownToLine size={17} />导出日历<span>.ics</span></button>}
      </section>}
      {section === 'timetable' && hasCourses && <>
      <section className="stats-strip" aria-label="课表统计">
        <div><section><span>已选课程</span><strong>{distinct}<small>门</small></strong></section></div>
        <div><section><span>教学周跨度</span><strong>{courseMaxWeek}<small>周</small></strong></section></div>
        <div><section><span>将生成日程</span><strong>{errors.length ? '—' : events.length}<small>次</small></strong></section></div>
        <div className="stat-status"><span className={`status-check ${settings.timesConfirmed && !errors.length ? 'ready' : ''}`}><CheckCheck size={21} /></span><section><strong>{settings.timesConfirmed && !errors.length ? '时间已核对' : '核对学期起点'}</strong><button className="text-button" onClick={() => setSection('settings')}>{settings.timesConfirmed ? '查看时间设置' : '设置第 1 周日期'}<ArrowRight size={13} /></button></section></div>
      </section>

      </>}
      {pendingCount > 0 && <div className="notice warning"><TriangleAlert size={17} /><span>{pendingCount} 个排课段为待筛选状态，已默认取消勾选；可在课程列表中核对。</span></div>}
      {(result.warnings.length > 0 || conflicts.length > 0) && <div className="notice warning"><TriangleAlert size={18} /><span>{result.warnings.length > 0 ? `${result.warnings.length} 条解析提示` : ''}{result.warnings.length > 0 && conflicts.length > 0 ? ' · ' : ''}{conflicts.length > 0 ? `${conflicts.length >= 100 ? '至少 ' : ''}${conflicts.length} 处课程时间冲突` : ''}</span><button className="text-button" onClick={() => setDiagnostics(true)}>查看详情<ChevronRight size={14} /></button></div>}

      {section === 'timetable' ? <div className="workspace-grid"><ImportPanel onImport={importResult} onGuide={() => setGuide(true)} compact={!hasCourses} filename={filename} />{hasCourses && <Timetable courses={result.courses} selected={selected} toggle={toggle} events={events} settings={settings} week={Math.min(week, maxWeek)} setWeek={setWeek} onEdit={setEditing} onSettings={() => setSection('settings')} maxWeek={maxWeek} term={result.term} />}</div> : <SettingsPanel settings={settings} setSettings={setSettings} section={section} courses={selectedCourses} onDone={() => setSection('timetable')} />}

      {hasCourses ? <><footer className="page-footer"><div><button onClick={() => { downloadText(JSON.stringify(coursePayload(result.courses, result.term), null, 2), 'timetable-backup.json', 'application/json;charset=utf-8'); setToast('已下载课程 JSON，包含所有排课段；学期设置不包含在此备份中。'); }}><FileJson size={14} />保存课程数据</button><button onClick={() => { setResult(emptyResult()); setSelected(new Set()); setFilename(''); setSettings(initialSettings()); setWeek(1); setSection('timetable'); setToast('已清空当前课表。'); }}><Trash2 size={13} />清空课表</button></div></footer>
      <p className="session-note">课程仅保留在当前页面中。离开前可保存课程数据，下次重新导入。</p></> : <p className="empty-privacy"><ShieldCheck size={14} />本地解析，无需登录，课表不会上传。</p>}
    </main>
    {guide && <Guide onClose={() => setGuide(false)} />}
    {editing && <CourseEditor course={editing} onClose={() => setEditing(null)} onSave={course => { setResult(current => ({ ...current, courses: current.courses.map(item => item.id === course.id ? course : item) })); setToast('课程已更新，日历预览已同步。'); }} />}
    {diagnostics && <Dialog title="需要核对的内容" onClose={() => setDiagnostics(false)} wide><div className="diagnostics-list">{result.warnings.map((warning, index) => <p key={index}><TriangleAlert size={16} />{warning}</p>)}{conflicts.slice(0, 30).map(([a, b], index) => <p key={`conflict-${index}`}><TriangleAlert size={16} /><span>{a.date} · {a.start}–{a.end}<br />「{a.course.name}」与「{b.course.name}」时间重叠。</span></p>)}{conflicts.length > 30 && <p>还有其他冲突，请按周或在课程列表中核对。</p>}</div><p className="muted">未识别的记录不会导出。可修正源文件后重新导入；时间冲突可通过课程编辑或取消勾选处理。</p></Dialog>}
    {exportOpen && <Dialog title={downloaded ? '日历已准备好' : '导出到你的日历'} onClose={() => setExportOpen(false)}>
      <div className="export-illustration">{downloaded ? <Check size={34} /> : <CalendarCheck2 size={34} />}</div>
      <p className="export-title">{settings.calendarName}</p><p className="export-subtitle">{distinct} 门课程 · {events.length} 次日程 · 中国标准时间</p>
      <div className="export-summary"><span>日期范围<strong>{events[0]?.date} — {events.at(-1)?.date}</strong></span><span>第 1 周周一<strong>{settings.firstMonday}</strong></span><span>课前提醒<strong>{settings.reminder < 0 ? '不提醒' : settings.reminder === 0 ? '上课时' : `提前 ${settings.reminder} 分钟`}</strong></span></div>
      {exportPreview && <section className="calendar-event-preview" aria-label="日历事件预览"><div className="calendar-preview-label">日历事件预览 · {settings.eventDetails === 'concise' ? '简洁' : '详细'}</div><h3>{exportPreview.title}</h3><p className="calendar-preview-time">{events[0].date} · {events[0].start}–{events[0].end}</p>{exportPreview.location && <p>{exportPreview.location}</p>}{exportPreview.description && <p className="calendar-preview-description">{exportPreview.description}</p>}</section>}
      {(result.warnings.length > 0 || conflicts.length > 0) && <p className="notice warning">此课表仍有解析提示或时间冲突，请先核对。未能解析的记录不在导出中。</p>}
      <button className="button primary full" onClick={download}><Download size={18} />{downloaded ? '重新下载 .ics 文件' : '下载 .ics 日历文件'}</button>
      {downloaded && <div className="import-instructions"><h3>接下来，导入日历</h3><p><strong>Apple 日历：</strong>打开 .ics 文件并选择日历。</p><p><strong>Google 日历：</strong>网页版设置 → 导入和导出。</p><p><strong>Outlook：</strong>添加日历 → 从文件上传。</p></div>}
      <p className="muted footnote">建议导入一个单独的「课表」日历。重复导入的行为取决于客户端；更新课表时，删除旧课表日历后再导入可避免重复。提醒也取决于客户端设置。</p>
    </Dialog>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </div>;
}
