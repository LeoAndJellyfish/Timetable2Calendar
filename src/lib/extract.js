/**
 * Runs both against a parsed HTML document and as a self-contained bookmarklet.
 * Keep all helpers inside this function: Function#toString builds the extractor.
 * Reads only course fields. Does not collect student identity, cookies or tokens.
 */
export function collectSchedule(doc) {
  const clean = (value) => String(value || '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim();
  const table = doc.querySelector('#kbgrid_table_0') || doc.querySelector('table[id^="kbgrid_table_"]');
  if (!table) throw new Error('未找到课表。请先登录教务系统，查询课表并切换到「表格」视图。');
  const records = [];
  for (const cell of table.querySelectorAll('td[id]')) {
    const position = cell.id.match(/^([1-7])-(\d+)$/);
    if (!position) continue;
    let previousName = '';
    for (const block of cell.querySelectorAll('.timetable_con')) {
      const title = clean(block.querySelector('.title')?.textContent);
      if (title) previousName = title.replace(/[★☆○◆◇●]+$/g, '').trim();
      const fields = {};
      for (const paragraph of block.querySelectorAll('p')) {
        const label = clean(paragraph.querySelector('[title]')?.getAttribute('title'));
        if (label) fields[label] = clean(paragraph.textContent);
      }
      const colorNodes = Array.from(block.querySelectorAll('[color], [style]'));
      const pending = colorNodes.some((node) => /^(red|#f00|#ff0000)$/i.test(node.getAttribute('color') || '') || /color\s*:\s*(red|#f00\b|#ff0000\b|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))/i.test(node.getAttribute('style') || ''));
      records.push({
        name: previousName,
        day: Number(position[1]),
        time: fields['节/周'] || '',
        location: fields['上课地点'] || '',
        teacher: fields['教师'] || '',
        className: fields['教学班名称'] || '',
        notes: fields['选课备注'] || '',
        pending,
      });
    }
  }
  if (!records.length) throw new Error('表格中没有课程。请确认学年、学期，并点击「查询」后重新提取。');
  return {
    format: 'timetable2calendar',
    version: 1,
    source: 'cufe-zhengfang',
    term: clean(table.querySelector('h6')?.textContent),
    records,
  };
}
