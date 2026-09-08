import { FileText, FileCode2, FileJson, ExternalLink, ShieldCheck } from 'lucide-react';
import { Dialog } from './Dialog';

export function Guide({ onClose }: { onClose: () => void }) {
  return <Dialog title="导入课表" onClose={onClose} wide>
    <p><a className="text-button" href="https://xuanke.cufe.edu.cn/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default" target="_blank" rel="noreferrer">打开教务课表<ExternalLink size={14} /></a></p>
    <p className="muted">支持 PDF、保存的 HTML 网页和课历 JSON 备份。</p>
    <div className="guide-steps">
      <div><span className="step-dot"><FileText size={17} /></span><section><h3>PDF 课表</h3><p>在教务系统查询课表后，打印或导出为 PDF，再回到课历选择或拖入文件。支持文字版表格、列表和跨页课表；扫描件与截图暂不支持。</p></section></div>
      <div><span className="step-dot"><FileCode2 size={17} /></span><section><h3>Ctrl + S 保存网页</h3><p>选择学年与学期，点击「查询」并切换到「表格」视图。等课程显示完整后按 <strong>Ctrl + S</strong>，保存为「网页，全部」或「网页，仅 HTML」。</p><p>回到课历导入保存的 <code>.html</code> 或 <code>.htm</code> 文件，旁边的资源文件夹无需导入。若网页没有保存课程内容，请改用 PDF。</p></section></div>
      <div><span className="step-dot"><FileJson size={17} /></span><section><h3>JSON 课表备份</h3><p>导入之前从课历保存的 <code>timetable-backup.json</code>，即可恢复课程。备份不包含学期设置、提醒、勾选状态和停调课规则，导入后请重新核对。</p></section></div>
    </div>
    <div className="notice neutral"><ShieldCheck size={19} /><div><strong>文件在浏览器本地解析</strong><p>课表不会上传。单个文件最大 5 MB，PDF 最多 50 页。</p></div></div>
  </Dialog>;
}
