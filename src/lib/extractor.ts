import { collectSchedule } from './extract.js';

export function extractionScript(): string {
  return `(() => {\n  try {\n    const data = (${collectSchedule.toString()})(document);\n    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json;charset=utf-8'}));\n    const link = document.createElement('a');\n    link.href = url;\n    link.download = 'cufe-timetable.json';\n    document.body.appendChild(link);\n    link.click();\n    link.remove();\n    setTimeout(() => URL.revokeObjectURL(url), 10000);\n  } catch (error) {\n    alert('课历：' + error.message);\n  }\n})();`;
}

export function bookmarklet(): string {
  return 'javascript:' + encodeURIComponent(extractionScript());
}
