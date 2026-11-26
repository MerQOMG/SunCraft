# 05 点交互状态检查轮 HANDOFF

时间：2026-11-26 05:17（Asia/Shanghai）。CEO 6388 第 8 步交互，一轮实现后停笔。**代码已停笔本阶段，等待主线程实看。未自我认证通过或回退。未改 lighting.ts、材质/模型体积、收口包或已停笔的 materials-gap / lighting-pass2 记录。本代理未使用浏览器或 computerUse。**

入口仍是 http://127.0.0.1:5174/ （不要开 5173、/legacy-demo 或远端）。本轮开始时旧进程已不在（10199 / 10200 无，端口拒绝连接），**不是**为改交互而重启仍在跑的 Vite。按既有 `SUNCRAFT_PYTHON=.../runtime-env/bin/python ./start-linked-dev.sh` 重新拉起，供主线程实看。当前：Vite 147926 监听 5174 HTTP 200；后端 147925 监听 8001 `/api/presets` HTTP 200。之后未再重启。

## 备份

- 改前 zip：`/workspace/suncraft-upload-20261125-2314/interaction-play-consistency-before.zip`
- 改前 SHA 清单：`/workspace/suncraft-upload-20261125-2314/interaction-play-consistency-before-sha256.json`
- lighting.ts `22325e24073117ff…`、materials.ts、styles.css、camera.ts、export.ts、Scene.tsx、ScoreRing.tsx、api.ts、freeze / materials-gap / lighting-pass2 记录的 SHA 与备份一致（见 `static-check.txt`）。

## 改动文件

产品源码（相对备份）：

- `前端文件/src/scoring/ScoreDrawer.tsx` — 等待态文案改为「更新中，上次分仅供对照 / 不是当前有效评分」；失败文案未改。
- `前端文件/src/AnnualTimeline.tsx` — 拖轴、日期、前后日、月份、节气在 pointerdown 先暂停；`jump` 仍是 `pause(); setDay(...)`，未改时钟公式。
- `前端文件/src/App.tsx` — 冬夏至快捷 pointerdown 先暂停；「重置参数与视角」补上 type=button 与说明性 aria/title。可见标签未改。
- `前端文件/src/annual.css` — `.annual-range` 增加 `touch-action:pan-x`；时间轴按钮 / 下拉 / 日期输入增加 `touch-action:manipulation`。未改尺寸、字号、布局。
- `前端文件/tests/interaction-play-capsule.test.tsx` — 新增等待 / 失败胶囊 SSR 定向检查（1 项通过）。

记录：`integration-notes/interaction-play/`（TARGETS.md、HANDOFF.md、changes.diff、check.py、static-check.txt、capsule-ssr.test.tsx、capsule-ssr.txt、http-evidence/）。

未改：lighting.ts、Scene.tsx、materials / 网格 / 灯光参数、export.ts、styles.css、backend 公式、freeze 打包文件。

## 行为规则（以代码为准）

### 播放中手动改日期：一律先暂停，再立即落到目标日，不回跳旧日

全部手动改日期路径都走 `jump`：年轴 `onChange`、日期输入、前一天 / 后一天、月份、节气下拉、顶栏「夏至正午 / 冬至正午」、以及「重置参数与视角」（`timeline.jump(SUMMER_DAY)`）。

`jump` 定义为：`pause(); setDay(clamp); setMessage('')`。`pause` 会把播放请求关掉、`clock.stop()`（generation token +1，已排队的 RAF 不会再推进），并 `setPlaying(false)`。因此播放中拖轴或按冬夏至，应先停再落到目标日；时钟 `stop()` 后不应跳回旧日。

本轮仅补了 **pointerdown 先 pause**（年轴、日期区、月份 / 节气、冬夏至分组），避免手指按下到 `onChange` / `click` 之间被播放时钟再推一天。规则本身未改，只是把「先暂停」提前到手势开始。

**不是日期改动、因此不暂停的路径：**

- 改倍速：若正在播放，只按新日速重启时钟，继续播放。1× / 2× / 4× = 每秒 4 / 8 / 16 日；播放按钮 aria 为「每秒`${speed*4}`日」。
- 仅相机「复位」（视口工具，aria「复位全景相机」）：只 `setResetToken`，不改日期、不暂停播放。
- 「日期剖面」按钮、采光热力开关。

### 年末

- 播放：`setDay(d=>(d+days)%DAY_COUNT)`，12-31 之后回到 1-1。
- 手动「后一天」在最后一天禁用，「前一天」在第 0 天禁用，不循环。

### 自动暂停（既有，本轮未改）

- 隐藏页：`visibilitychange` 暂停；若 tick 时 `document.hidden` 也暂停。
- `prefers-reduced-motion: reduce` 变化时暂停。
- 导出：`flushSync(timeline.pause())` 后锁快照。

### 「重置参数与视角」落到的确定值

`reset()`：`cancelOptimize()`；参数恢复 `DEFAULTS`（挑檐 0.4 m、百叶 0°、窗墙比 45%）但 **保留当前城市与纬度**；`timeline.jump(SUMMER_DAY)` → **暂停播放，日期落到 2026-06-21 夏至**；关闭采光热力；清空寻优对比与 optError；`resetToken++` → `fitCamera`（`manualCamera=false`，按当前画布自动取景）。抽屉开合、导出日期缓存不在此函数里清除。

请勿把视口里的「复位」当成同一动作：它只复位全景相机。

### 等待 / 失败 / 取消 / 空数据

- `currentResult = pending || hasError ? null : result`（既有）。参数变化或请求未完成时，旧分析场 / 旧工况线让出「当前结果」位置，不用缓动把过期画面多停一会儿。评分胶囊在等待时仍展示上次数字，但文案改为对照（见下）。失败时 `report={null}`，环形分数清空。
- 等待胶囊（本轮修改）：strong「上次 · S级」（有上次等级时）；small「更新中 · 上次分仅供对照」；aria「冬夏工况评分更新中，上次分数仅供对照，不是当前有效评分 …」。抽屉说明：「参数已变化，评分更新中；以下为上次返回，仅供对照，不是当前有效结果。」无上次报告时 small 仍为「评分请求中」。
- 失败胶囊（本轮未改，且不重做已通过实看）：「不可用 / 不以上次成功为准」，不显示上次 91.1。
- 寻优取消（本轮未改代码）：「取消寻优」在 `fieldset.sliders[disabled=busy]` **之后**的 `.optimize-area`，忙碌时可点。`cancelOptimize` 增加 operation、abort、杀掉补间、busy=false；`cancelAndSnap` 再把挑檐收到 0.05 m 网格、角度收到整度，并 `setComparison(null)`。abort 在 catch 里按既有逻辑忽略，不报假失败。忙碌时模拟暂停，`currentResult` 为空。

### 409 / 422 / 超时（API 层一次复现，非界面实看）

证据：`http-evidence/`。前端映射在 `api.ts`，本轮未改。

- 409：`POST /api/optimize` 上海 31.2、挑檐 0.4 m、百叶 0°、窗墙比 0.25 → HTTP 409，约 0.032 s。`reason=daylight_target_unreachable`，最大面积比例 0.576…，目标 0.8。映射文案：「当前窗墙比下没有满足采光目标的候选（最大面积比例57.6%，目标80.0%）；请调整窗墙比后重试。HTTP 409」。第一次误用纬度 31.2304 得到的是 422 预设不匹配，不是 409。
- 422：`POST /api/simulate` 挑檐 1.81 m → HTTP 422，「Input should be less than or equal to 1.8」。映射：「后端响应 HTTP 422：Input should be less than or equal to 1.8」（英文原文保留）。
- 超时：未复现（不挂起 8001）。代码在 8 秒 abort 后抛出「后端响应超时（8 秒），请检查服务」。

### 键盘与触屏（源码，未实看）

时间轴播放 / 暂停、倍速、年轴、日期、前后日、冬夏至、重置、取消、抽屉页签与主要按钮均为原生可聚焦控件。月份 / 节气在折叠「月份 / 节气」内，需先展开。年轴 `touch-action:pan-x`，避免与页面纵向滚动抢手势；播放 / 冬夏等按钮 `manipulation`。画布仍是 `touch-action:none`（既有）。未加新的装饰动效；ScoreRing 在减少动态时 duration 仍为 0，值为 null 时立即清空（失败路径）。

## 静态 / 定向检查证据

- `integration-notes/interaction-play/static-check.txt` — 52 项源码规则全部通过（含锁定文件 SHA、jump 路径、等待 / 失败文案、touch-action、取消按钮位置、409 映射）。
- `integration-notes/interaction-play/capsule-ssr.txt` 与 `前端文件/tests/interaction-play-capsule.test.tsx` — vitest 1 passed（等待胶囊含「上次 · S级」「仅供对照」「91.1」；失败胶囊含「不可用 / 不以上次成功为准」、不含 91.1）。
- `changes.diff`、`http-evidence/`。
- 定向跑 `tests/scoring.test.tsx`：21 passed，**1 failed**，与本轮无关：该测试渲染的是 ScoreDrawer 而不是 ScoreCapsule，却断言含「非当前方案评分」；该句只存在于胶囊 aria（改前改后都只有一处）。本轮未改示例文案、也未改该测试。

未跑 npm test 全套，未做 production / offline build。

## 最不满意 3 处

1. 等待态仍用大号环形数字展示上次分数（SSR 中可见 91.1 与环上 S）。虽已改为「上次 · S级」+「更新中 · 上次分仅供对照」，数字视觉权重仍最大，是否还像「当前有效结果」只能由主线程实看判断。本轮没有在 pending 时清空环形（以免等待态看起来像失败）。
2. 422 映射会把后端英文校验句直接拼进「后端响应 HTTP 422：…」。409 中文映射已有 HTTP 证据，但这些原文如何出现在界面 error-box 里未实看。超时未做实锤。
3. 寻优请求往往极短（本次 409 仅约 32 ms），忙碌与补间窗口很难抓住；取消后补间停在哪、会不会闪过旧成功结果，本轮记为未验，而不是反复追。另外，视口「复位」不暂停播放，与「重置参数与视角」容易混淆。

## 未验证项（含本代理不能浏览器实看的全部）

- 播放中拖年轴、播放中按冬夏至的真实手感，是否暂停并立即落到目标日、是否回跳旧日。
- 日期 / 太阳 / 副面与 3D 是否一致；评分与 DF 是否不随日期伪变（代码既有，需实看）。
- 暂停、倍速、重置后的确定落点；仅相机「复位」是否保持播放。
- 等待胶囊对照文案在 1271×667 / 400×534 是否够清楚、会否把胶囊撑折行。
- 409 / 422 / 超时文案在 UI 中的完整显示；寻优取消的中途补间与「不报假失败」。
- 键盘可达与触屏拖轴 / 点冬夏 / 播放是否误触或与滚动抢手势。
- 隐藏页、减少动态自动暂停；导出锁快照（既有规则，本轮未再实看）。
- 已通过的失败态实看未重做（断网脚注、失败胶囊不再显示上次 91.1、广州图例、禁用导出描边）。

## 主线程实看顺序

视口尽量 **1271×667**（不要用 1262×650 冒充），默认上海 0.4 m / 0° / 45%，复位全景，热力默认关。窄屏尽量真到 **400×534**（不要用 500×671 代替）。

1. 先播放，再拖年轴：应暂停并立即落到拖到的日期；日期 / 太阳 / 副面与 3D 一致；评分与 DF 不随日期变。
2. 再播放，再按冬至 / 夏至：同一套规则（先暂停再落到目标日），同样核对太阳副面与 3D，评分 / DF 不随日期变。
3. 再查暂停、1× / 2× / 4× 倍速（aria 与每秒 4 / 8 / 16 日一致）、以及「重置参数与视角」（停在夏至、默认构件、全景复位、保留城市）。不要用「复位」相机按钮代替完整重置。
4. 快查：改参数后的等待文案（「更新中，上次分仅供对照」，不能像当前有效结果）；失败 / 取消若能碰到再看（取消忙碌时可点，不报假失败）；键盘 Tab 到播放 / 倍速 / 年轴 / 冬夏 / 重置 / 取消 / 抽屉；触屏拖年轴不要带动页面滚动。

不要开始 06 点适配性能、07 点导出收尾或 08 点冻结。材质 gap 的视觉收口仍归上一阶段的主线程判断，本轮未返工。
