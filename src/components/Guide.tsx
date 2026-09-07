import { useRef, useEffect, useState } from 'react';
import { ArrowUpRight, BookmarkPlus, Check, Copy, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { bookmarklet, extractionScript } from '../lib/extractor';
import { downloadText } from '../lib/download';
import { Dialog } from './Dialog';

export function Guide({ onClose }: { onClose: () => void }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  // A bookmarklet is intentionally a javascript URL. Do not execute it on this app.
  useEffect(() => { linkRef.current?.setAttribute('href', bookmarklet()); }, []);
  const script = extractionScript();
  async function copy() {
    try { await navigator.clipboard.writeText(script); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <Dialog title="把教务课表带出来" onClose={onClose} wide>
    <p className="muted">先在学校网站登录并查询课表，再把导出的文件导入课历。</p>
    <div className="notice neutral"><Download size={19} /><div><strong>已有 PDF？可以直接导入</strong><p>教务系统「表格」和「列表」视图输出的文字版 PDF 均可导入，也支持跨页课表。回到首页选择或拖入文件，再核对第 1 周日期与作息时间。扫描件、截图转成的 PDF 暂不支持。</p></div></div>
    <h3 className="guide-section-title">也可以从网页提取课表</h3>
    <div className="guide-steps">
      <div><span className="step-dot">1</span><section><h3>打开中央财经大学课表</h3><p>选择正确的学年、学期，点击「查询」，使用「表格」视图。</p><a className="text-button" href="https://xuanke.cufe.edu.cn/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default" target="_blank" rel="noreferrer">打开教务课表<ExternalLink size={14} /></a></section></div>
      <div><span className="step-dot">2</span><section><h3>添加提取书签</h3><p>把下面的按钮拖到浏览器书签栏。回到课表页面，点击这个书签，会下载 <code>cufe-timetable.json</code>。</p><a ref={linkRef} className="button primary bookmark-button" draggable onClick={event => { event.preventDefault(); setCopyError(false); }} title="拖到浏览器书签栏，然后在教务课表页面点击"><BookmarkPlus size={17} />提取课表<ArrowUpRight size={16} /></a><small className="muted block">请拖动按钮，不是直接点击。Windows 可用 Ctrl + Shift + B 显示书签栏。</small></section></div>
      <div><span className="step-dot">3</span><section><h3>回到课历，导入文件</h3><p>选择下载的 JSON，核对第 1 周日期和作息时间，即可导出日历。</p></section></div>
    </div>
    <details className="guide-code"><summary>书签不可用？查看完整脚本</summary><p className="muted">也可在教务课表页面的开发者工具 Console 中运行以下脚本。如果浏览器阻止粘贴，改用保存网页的方式。</p><textarea className="code-input" aria-label="提取脚本" readOnly value={script} spellCheck={false} /><div className="button-row"><button className="button secondary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制脚本' : '复制脚本'}</button><button className="button secondary" onClick={() => downloadText(script, 'extract-cufe-timetable.js', 'text/javascript;charset=utf-8')}><Download size={16} />下载脚本</button></div>{copyError && <p role="status" className="error-message">剪贴板不可用，请在文本框内全选并复制。</p>}</details>
    <div className="notice neutral"><ShieldCheck size={19} /><div><strong>脚本只读取课表</strong><p>不读取账号、学号或 Cookie，不发送网络请求。提取的课程信息只保存到你的下载目录。</p></div></div>
    <p className="guide-alternative"><strong>另一个方法：</strong>在课表查询完成后按 Ctrl + S 保存为 HTML 网页，再导入。若文件不含动态课程，请使用提取工具。</p>
  </Dialog>;
}
