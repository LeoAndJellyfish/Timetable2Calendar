import { parseInput } from '../../src/lib/parser';

// Synthetic parser/calendar fixtures only; never imported by the application.
export const DEMO_PAYLOAD = {
  format: 'timetable2calendar', version: 1, source: 'demo', term: '2026–2027 学年 · 秋季学期',
  records: [
    { name: '高等数学', day: 1, time: '(1-2节)1-16周', location: '示例教学楼 A201', teacher: '陈老师', className: 'DEMO-MATH' },
    { name: '微观经济学', day: 2, time: '(3-5节)1-16周', location: '示例教学楼 B302', teacher: '林老师', className: 'DEMO-ECON' },
    { name: '程序设计基础', day: 3, time: '(1-2节)1-16周', location: '示例实验楼 106', teacher: '周老师', className: 'DEMO-CODE' },
    { name: '大学英语', day: 4, time: '(3-4节)1-16周', location: '示例教学楼 A305', teacher: '许老师', className: 'DEMO-ENG' },
    { name: '统计学', day: 5, time: '(1-2节)1-16周', location: '示例教学楼 B201', teacher: '郑老师', className: 'DEMO-STAT' },
    { name: '人工智能导论', day: 1, time: '(7-8节)1-8周', location: '示例实验楼 202', teacher: '王老师', className: 'DEMO-AI' },
    { name: '人工智能导论', day: 1, time: '(7-8节)9-16周', location: '示例实验楼 202', teacher: '李老师', className: 'DEMO-AI' },
    { name: '数据可视化', day: 3, time: '(7-9节)1-16周(单)', location: '示例实验楼 304', teacher: '吴老师', className: 'DEMO-VIZ' },
    { name: '体育', day: 4, time: '(9-10节)1-16周', location: '示例体育馆', teacher: '杨老师', className: 'DEMO-PE' },
    { name: '通识研讨', day: 2, time: '(12-13节)3-12周(双)', location: '示例教学楼 A102', teacher: '赵老师', className: 'DEMO-SEMINAR' },
  ],
};
export const demoResult = () => parseInput(JSON.stringify(DEMO_PAYLOAD));
