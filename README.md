# 课历 · Timetable2Calendar

把中央财经大学教务课表转换为日历。支持 **PDF / HTML / JSON 导入 → 核对课程与学期 → 导出 `.ics`**，解析在浏览器本地完成，无需提供教务账号。

## 功能

- **课表导入**：适配中财正方教务系统的网页，以及文字版表格 / 列表 PDF；支持跨页、旋转页面、合并单元格和分段教师。
- **周次解析**：支持单双周、不连续周次、分段授课；重复记录去重，不连续节次拆分为独立日程。
- **预览与编辑**：按周查看、搜索课程、选择导出范围，编辑课程名、教师、地点、星期、节次和周次。
- **可编辑校历**：自行设置第 1 周周一、每日作息、整日停课和调课，显示时间冲突。
- **日历导出**：生成带 `Asia/Shanghai` 时区定义的 iCalendar 文件，可选择简洁 / 详细备注和课前提醒。
- **简洁界面**：默认首页只显示导入入口，导入后展示课程统计、设置和预览；支持手机布局。

## 本地运行

需要 **Node.js 22.12+** 和 npm。

```sh
git clone https://github.com/LeoAndJellyfish/Timetable2Calendar.git
cd Timetable2Calendar
npm ci
npm run dev
```

打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)。

```sh
npm run check    # 测试、类型检查和生产构建
npm run preview  # 预览 dist，端口 4173
```

开发与预览服务器默认只监听本机。启动开发服务器或构建时，会自动准备 PDF.js 的 CMap 和标准字体，无需手动复制资源。

## 使用方法

1. 登录学校教务系统，查询对应学年、学期的课程表。
2. 导出文字版 PDF，或通过课历的「使用指南」将提取按钮拖到书签栏，再回到教务课表的「表格」视图点击书签，保存 JSON。包含完整课程内容的 HTML 网页也可导入。
3. 选择或拖入 PDF / HTML / JSON；HTML 和 JSON 还可直接粘贴。单个文件最大 **5 MB**，PDF 最多 **50 页**。
4. 在「学期与时间」设置**第 1 周周一**并核对作息。初始日期仅为可修改的起点，请以每学期校历为准。
5. 预览课程，按需编辑、取消勾选或添加停调课规则，然后导出 `.ics`。

待筛选课程默认不选入导出；无法解析的记录和时间冲突会显示提示。导入成功会替换当前课程并清空停调课规则；导入失败保留原课表。

Apple 日历可打开 `.ics` 文件；Google 日历网页版和 Outlook 可使用文件导入功能。建议建立一个独立的课表日历，更新时替换旧课表，避免重复导入。各客户端的提醒、颜色和重复导入行为可能不同，尚未逐一实测。

## 日历格式

每次授课生成一个独立事件，按照指定的周次和节次展开：

| 内容 | 简洁格式（默认） | 详细格式 |
| --- | --- | --- |
| 标题 | 课程名 | 课程名 |
| 地点 | 教室，移除独立校区前缀 | 完整校区和教室 |
| 备注 | 教师 | 教师、周次、节次、教学班及备注 |

两种格式都保留调课和待筛选提示。默认不提醒，可选择上课时或提前提醒。文件包含上海时区定义、稳定 UID、UTF-8 折行和橙色日历元数据；客户端决定是否采用颜色。

默认 13 节作息依据《中央财经大学关于调整学校教学作息时间的通知》（校发〔2019〕5 号），每节 45 分钟，可在界面中逐项修改。

## 数据与限制

- 没有课表上传接口、账号托管、分析统计或外部字体 CDN。网页提取脚本不读取学号、密码或 Cookie，也不发送网络请求。
- HTML 在独立解析器中处理，不执行其中脚本、不加载资源、不插入页面 DOM。PDF 通过 PDF.js 读取文字与坐标。
- 数据仅保留在当前页面内存中，**刷新或关闭页面会清空**。离开前可下载课程 JSON 备份；备份不包含学期设置、提醒、勾选状态和停调课规则。
- 暂不支持扫描件 / 截图 OCR、加密 PDF、任意学校自动识别、自动节假日推断、订阅地址或持续同步。教务系统调整格式后可能需要更新适配器。
- 当前支持的学期日期为 2000–2099 年；界面默认示例日期不代表学校实际校历。

## 测试

```sh
npm test
npm run build
```

52 项常规测试覆盖 HTML / JSON 提取、PDF 版面解析、分段与单双周、异常输入、停调课、冲突、时区和 ICS 规范；使用独立的 `ical.js` 回读日历。构建回归测试检查 PDF worker 的输出扩展名、内容与引用。

另有 2 项可选本地集成测试：设置 `PDF_SAMPLE_FILES`（两份匹配样本路径组成的 JSON 数组），以及可选的 `CALENDAR_REFERENCE_FILE`（参考 ICS 路径）。这些测试面向开发时使用的固定样本，校验两种 PDF 布局结果一致及 188 个日程字段匹配；未提供文件时自动跳过。个人样本不会提交到仓库。

## 部署

运行 `npm run build`，将完整的 **`dist/`** 部署到支持 HTTPS 的静态网站主机根路径。无需后端。

当前静态资源使用根路径；部署到子目录时，需要同时调整 Vite base、字体地址和 PDF 资源地址。请完整保留构建产物中的 PDF worker、CMap、标准字体和许可证文件。

### EdgeOne 部署

构建命令使用 `npm run build`，输出目录填写 `dist`。PDF worker 会输出为带哈希的 `.js` 文件，以兼容将 `.mjs` 默认识别为 `application/octet-stream` 的静态托管环境；模块内容与 PDF.js 原文件一致。

若出现 `Setting up fake worker failed`，请在浏览器 Network 中检查 worker 请求：应返回 200，且 `Content-Type` 为 `text/javascript` 或 `application/javascript`。401/403 表示访问验证问题；404 或返回 HTML 则需检查部署目录和重写规则。临时预览域名可能要求完整的访问验证链接，绑定自定义域名不能替代正确的资源类型配置。

更新版本后请重新部署完整构建，并刷新已打开的页面，以加载新的 worker 地址。

## 项目结构

```text
src/
  components/       导入、课表、设置、课程编辑与弹窗
  lib/
    parser.ts       课程规范化与校验
    extract.js      HTML 与书签脚本共用的 DOM 收集器
    pdf*.ts         PDF.js 读取与表格/列表版面还原
    calendar.ts     日期展开、停调课、冲突及 ICS
    settings.ts     默认作息与 JSON 备份格式
  styles.css        界面与响应式样式
public/fonts/       本地字体及许可证
scripts/            构建前准备 PDF 资源
tests/              自动化测试与虚构 fixture
```

技术栈：React、TypeScript、Vite、PDF.js、linkedom、Lucide。界面参考 LightMuse 的暖灰、衬线标题与胶囊按钮风格，字体和资源已独立放入本项目。

## 参考与许可

- [WakeupSchedule_Kotlin](https://github.com/tKM9WsmQUaUgNttn3DGUsHkxG8/WakeupSchedule_Kotlin)：参考网页导入与课程数据分离的思路，未复制其源码。
- [中财教务课表](https://xuanke.cufe.edu.cn/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default)：当前适配目标。本项目为独立工具，非学校官方产品。
- [iCalendar · RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)：日历文件格式。

本项目源码采用 [MIT License](LICENSE)。字体及第三方依赖保留各自许可证，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
