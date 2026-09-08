import { useRef, useState, type DragEvent } from 'react';
import { ArrowUpRight, FileCode2, Upload, ShieldCheck, Braces, ArrowRight, FileCheck2 } from 'lucide-react';
import { MAX_INPUT_BYTES, parseInput } from '../lib/parser';
import type { ImportResult } from '../lib/types';
import { Dialog } from './Dialog';

export function ImportPanel({ onImport, onGuide, compact = false, filename }: { onImport: (result: ImportResult, filename: string) => void; onGuide: () => void; compact?: boolean; filename: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reading = useRef(false);
  const [progress, setProgress] = useState('');

  function readText(text: string, name: string) {
    try { const result = parseInput(text); onImport(result, name); setError(''); setPasting(false); setInput(''); }
    catch (err) { setError((err as Error).message); }
  }

  async function readFile(file?: File) {
    if (!file || reading.current) return;
    setError('');
    if (!/\.(pdf|html?|json)$/i.test(file.name)) { setError('请选择 PDF、HTML 或 JSON 文件。截图暂不支持。'); return; }
    if (file.size > MAX_INPUT_BYTES) { setError('文件超过 5 MB，请只保存个人课表，或改用教务系统导出的 PDF。'); return; }
    reading.current = true;
    setBusy(true); setProgress('正在读取课表…');
    try {
      const bytes = await file.arrayBuffer();
      if (/\.pdf$/i.test(file.name)) {
        setProgress('正在加载 PDF 解析器…');
        const { parsePdf } = await import('../lib/pdf');
        const result = await parsePdf(bytes, (page, total) => setProgress(`正在解析第 ${page} / ${total} 页…`));
        onImport(result, file.name); setPasting(false); setInput('');
      } else {
        let text = new TextDecoder('utf-8').decode(bytes);
        if (text.includes('\uFFFD')) text = new TextDecoder('gb18030').decode(bytes);
        readText(text, file.name);
      }
    } catch (err) { setError(err instanceof Error ? err.message : '无法读取文件，请重新选择。'); }
    finally { reading.current = false; setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  function drop(event: DragEvent) {
    event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files[0]);
  }

  return <aside className={`import-panel panel ${compact ? 'import-panel-simple' : ''}`} id="import-panel" aria-label="课表导入">
    {!compact && <><div className="panel-eyebrow">01 / IMPORT</div>
    <h2>导入你的课表</h2>
    <p className="muted import-desc">一份课表文件，就能开始。</p></>}
    <input ref={fileInput} type="file" accept=".pdf,.html,.htm,.json" className="visually-hidden" tabIndex={-1} aria-label="选择课表文件" onChange={event => void readFile(event.target.files?.[0])} />
    <button id="import-trigger" className={`dropzone ${dragging ? 'dragging' : ''}`} aria-label="选择或拖入课表文件" aria-busy={busy} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => fileInput.current?.click()} disabled={busy}>
      <span className="upload-icon"><Upload size={23} strokeWidth={1.6} /></span>
      <strong role="status">{busy ? progress : '将课表拖到这里'}</strong>
      {!busy && <span className="choose-file-label">或点击选择文件<ArrowUpRight size={13} /></span>}
      <span>PDF / HTML / JSON · 最大 5 MB</span>
    </button>
    {compact ? <div className="simple-import-actions"><button className="text-button" disabled={busy} onClick={() => { setError(''); setPasting(true); }}><Braces size={15} />粘贴课表内容</button><button className="text-button" onClick={onGuide}>如何获取课表<ArrowUpRight size={14} /></button></div> : <><p className="pdf-import-hint">PDF 支持教务系统导出的表格版、列表版。</p>
    <div className="or-divider"><span />或者<span /></div>
    <button className="button secondary full" disabled={busy} onClick={() => { setError(''); setPasting(true); }}><Braces size={17} />粘贴课表内容<ArrowRight size={15} /></button></>}
    {error && !pasting && <p role="alert" className="error-message">{error}</p>}
    {filename && <div className="file-status"><FileCheck2 size={17} /><span title={filename}>{filename}</span></div>}
    {!compact && <><div className="how-to">
      <h3><FileCode2 size={17} strokeWidth={1.5} />还没有课表文件？</h3>
      <p>从教务系统导出 PDF，或按 Ctrl + S 保存课表网页。</p>
      <button className="text-button" onClick={onGuide}>查看导入指南<ArrowUpRight size={15} /></button>
    </div>
    <div className="privacy-note"><ShieldCheck size={17} /><span>数据留在你的设备<small>无需登录，不上传课表。</small></span></div></>}
    {pasting && <Dialog title="粘贴课表内容" onClose={() => setPasting(false)}>
      <p className="muted">粘贴已保存的课表 HTML，或课历 JSON 备份的完整内容。导入后会替换当前课表。</p>
      <textarea className="code-input" aria-label="课表 HTML 或 JSON" placeholder={'<table id="kbgrid_table_0">…\n\n或 { "format": "timetable2calendar", … }'} value={input} onChange={event => setInput(event.target.value)} autoFocus spellCheck={false} />
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="button secondary" onClick={() => setPasting(false)}>取消</button><button className="button primary" onClick={() => readText(input, '粘贴的课表')}>解析课表<ArrowRight size={16} /></button></div>
    </Dialog>}
  </aside>;
}
