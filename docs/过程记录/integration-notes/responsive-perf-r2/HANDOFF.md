# 06 点适配与性能轮 HANDOFF

时间：2026-11-26 06:18（Asia/Shanghai）。CEO 第 9 步，一轮实现后停笔。**代码已停笔本阶段，等待主线程实看。未自我认证通过或回退。未使用浏览器或 computerUse。未改 lighting.ts、材质/模型体积、收口包，以及已停笔的 materials-gap / lighting-pass2 / interaction-play / 02:40 responsive-perf 记录。未开始 07 点导出收尾或 08 点冻结。未跑自动化测试全套或 production/offline 构建，未撰写任何帧率数字。**

入口仍是 http://127.0.0.1:5174/ 。本轮开始时服务已在跑（Vite 147926、后端 147925），**未重启**。之后 5174 与 8001 `/api/presets` 仍为 HTTP 200，依赖 Vite 热更新。

02:40 那一轮主要修失败胶囊和隐页停止排程 RAF，当时明确未改布局 CSS；400×534 未互盖是当时结论。此后交互轮改过 `annual.css`（touch-action），本轮按**当前源码**重验，不把 02:40 当成本步已完成。

## 备份

- `/workspace/suncraft-upload-20261125-2314/responsive-perf-r2-before.zip`
- `/workspace/suncraft-upload-20261125-2314/responsive-perf-r2-before-sha256.json`
- lighting.ts `22325e24073117ff…`、materials、styles.css、camera、export、ScoreDrawer、AnnualTimeline、contactAO、freeze / materials-gap / lighting-pass2 / interaction-play / 02:40 responsive-perf 记录的 SHA 与备份一致。

## 改动文件与为何改

产品源码只改了两处，都有静态证据：

- `前端文件/src/Scene.tsx` — WebGL 最小守卫。Three r181 在 `getContext` 为 null 时会抛错，现有构造 `catch` 覆盖这一条；**构造成功但上下文已丢失或随后不可用**不在原 catch 内，且原 `webglcontextlost` 监听加在场景搭完之后。现于构造后立即检查 `getContext()` / `isContextLost()`，失败则 dispose 并使用同一句「当前浏览器无法启用 WebGL，参数与剖面仍可使用。请开启硬件加速后重试。」监听改到配置渲染器之前。`contactPipeline` 包在 try 中，浮点扩展或 AO 初始化失败时退回无后期（`dataset.contactAO=unavailable`），不新做 2D 场景。未改材质、网格、灯光参数、阴影图尺寸、dpr、播放规则。
- `前端文件/src/annual.css` — 展开「月份 / 节气」时的高度预留。桌面 `.annual-extra` 已有 `max-height:164px` 且向上展开，但 `--annual-row-height` 仍是收起态 108px，场景只按 `108+52` 让底，静态上额外最多 164px 会盖住画布下部（窗、冬至光带风险）。窄屏时间轴为 absolute，预留 212px，而 extra 原为 `max-height:none`，展开后会落入按 212px 定位的胶囊/复位/页签。最小修正：`.workspace:has(.annual-extra)` 在 ≥761px 把行高改为 `108+164+18`；窄屏给 extra `max-height:min(36dvh,220px); overflow:auto`，并把预留改为 `212 + 该上限 + 16`。**收起态构图公式未改。** 未改 `styles.css`、主布局字号、失败胶囊或播放 JS。

记录：`integration-notes/responsive-perf-r2/`（TARGETS.md、HANDOFF.md、changes.diff、static-check.txt）。

未改产品代码的部分：渲染成本（见下，静态看不出必须改）；已有窄屏流式 / 360 列 / 桌面右侧预留槽 / 761×620 预览折入抽屉 / dvh / safe-area，规则仍在且层叠顺序正确（`main.tsx`：styles → scoring → annual），无破损则不为观感大改。

## 适配规则（当前源码）

- 断点：窄屏 `max-width:760px`；桌面 `min-width:761px`；中宽 761–1200 / 761–960 收左右栏；360 再压缩热力标签与胶囊；矮桌面 `min-width:761px and max-height:620px` 把挂钩剖面前移到抽屉列，避免再占首屏高度。
- 工作区：桌面 `height:100dvh; overflow:hidden`；窄屏 `overflow-y:auto`，面板 `padding-bottom: env(safe-area-inset-bottom)`。
- 窄屏画布：`--mobile-scene-height: clamp(240px, 47dvh - 100px, 340px)`，时间轴在画布下 `119px + scene + 10px`。胶囊/复位/页签/抽屉的 `--mobile-score-top` 含时间轴预留（收起 212px；展开另加 cap）。400×534 收起公式：画布 240、时间轴 top 369、胶囊 top 591（在 534 视口之下，需滚动），预留不互盖。展开后时间轴变高，后续控件随变量下移，extra 内部可滚动。
- 桌面：时间轴底锚 44px，场景 `bottom: calc(var(--annual-row-height) + 52px)`。收起行高 108px（1271×667 场景约 405px；761×620 约 358px）。展开月份/节气后行高 290px（同视口场景约 223 / 176px），避免 extra 盖住模型下部。
- 桌面打开评分：`.score-report-open` 将场景/说明/图例右缘让出 `gutter+372`，而不是把 360 列画在窗/电视上。窄屏抽屉仍在画布下方流式，不盖房间。
- 缩放：无 `visualViewport` 监听。浏览器缩放改变 CSS 像素，761 等断点按布局视口生效。125%/150% 可能把 1271 宽桌面落到中宽或越过 761 变成窄屏流式——需按实看时的真实 CSS 宽高命名，不要用邻近视口冒充。
- 播放规则未改：手动改日期先暂停再落地；改倍速不暂停；年末循环；隐页与减少动态自动暂停。

## 降成本取舍（未改渲染质量）

已有且续用：`shadowMap.autoUpdate=false`，仅当参数/季节/solarFrame 键变化时 `needsUpdate=true`；热力不随日期变，仅 `heatmap_grid` 引用变化时重建 384 画布；热力显示时 `ao.enabled=false`；隐页停止排程 RAF（`frameId=0`），可见再启动；宽或高 ≤0 的 resize 跳过；dpr 上限 1.65；AO 短边上限见 lighting `aoMaxDimension:900`（本轮未改 lighting.ts）；阴影图仍 2048、PCF 软阴影。

播放时 solarFrame 逐日变，因此会按日更新阴影并重绘（GTAO 在热力关闭时仍走后期）。可见时 tick 仍每帧排程，但无 `needsRender` 时不调用 `renderer.render`。

静态看这些守卫已经针对「不必每帧更新阴影/热力」，**看不出必须再降质量的成本问题**，因此不为改而改，也不得把未测帧率写成结论。若主线程实看觉得播放开热力后不跟手，建议的下一刀（本轮未做）是：仅在播放中临时降低阴影分辨率或关闭 AO / 降低 dpr，暂停、拖轴、切冬夏、改参数仍立刻更新，**停播后恢复**现有质量。不要为 Network/FPS/ReadPixels 工具限制反复追试。

## 无 WebGL 降级：验证方法与边界

文案未改。新增的是构造后可用性检查、更早的丢失监听、AO 初始化失败时降为无后期。

建议主线程用下列**不打开 Chrome 设置、不进「删除浏览数据」**的方法：

1. **上下文丢失（最稳、可在已打开的 5174 上做）**：默认上海方案加载完成后，在页面 DevTools 控制台执行  
   `document.querySelector('.scene canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()`  
   （若为 WebGL1，把 `webgl2` 改成 `webgl`）。应出现：「3D 渲染上下文已丢失，请刷新页面。参数与 SVG 剖面仍可使用。」参数与剖面仍可操作；3D 画布可停在失败条。不要指望本页自动恢复（未做 contextrestored 重搭场景）。刷新后应恢复（若 GPU 仍可用）。
2. **构造失败（需在加载前关掉 WebGL）**：不要用 Chrome 设置页。可用 Firefox `about:config` 将 `webgl.disabled` 设为 true 后**再打开** 5174；或用单独的 Chromium 进程参数 `--disable-webgl` 启动（不是站点设置）。应出现：「当前浏览器无法启用 WebGL，参数与剖面仍可使用。请开启硬件加速后重试。」测完务必改回。构造后立即丢失（本轮新守卫）很难在真实浏览器里单独制造，与构造失败共用同一文案。
3. **边界**：不覆盖完整 2D 替代；不覆盖软件渲染极慢但仍能创建上下文的情况（未开 `failIfMajorPerformanceCaveat`）；AO 初始化失败只有 `data-contact-ao=unavailable` 与无接触 AO，没有单独提示条；无法在本代理环境用浏览器证实。

## 静态证据

`integration-notes/responsive-perf-r2/static-check.txt`：54 项通过（锁定文件 SHA、断点与层叠、400×534 / 761×620 / 1271×667 公式、`:has` 预留、WebGL 守卫、阴影/热力/隐页 RAF、播放 jump 未改）。`changes.diff` 仅含上述两文件。

## 最不满意 3 处

1. 761px 宽打开细则时，右侧让槽约 372px，场景会被压到约 159px（按当前 `--left/--gutter` 公式）。这是已有「不盖窗/电视」的取舍，本轮不改槽宽。请在真能达到的 761×620（或该断点附近真实宽高）打开抽屉，确认仍可看关键面、控件可点。
2. 未测帧率。播放 + 阴影 2048 +（关热力时）GTAO + dpr 1.65 是否跟手，只能由实看感觉判断，不能写成已经够快或必须降质。
3. 前序残留未加码：等待态大号环形数字仍像当前分；窄屏等待折行只记下；寻优取消与 409/422/超时界面未验；墙面/沙发/地毯仍偏平。「重置参数与视角」不改回 1×。展开年轴后的 164/220 预留是否刚好，150% 缩放是否掉进窄屏布局，需实看而不是再猜一版高度。

## 未验证项与验证边界

- 全部浏览器实看，包括真 400×534、矮屏 ≥761 且高度约 620 或更矮、125%/150% 缩放或等效 visualViewport、开/关抽屉、展开年轴细节是否还挡窗/电视/冬至光带、控件是否可操作。
- 无 WebGL / 上下文丢失的真实界面（见上模拟方法）。
- 播放时开/关热力是否跟手（可说卡顿或跟手，禁止写 FPS 数字）。
- `:has()` 在目标浏览器的可用性（现代 Chromium / Firefox / Safari 已支持；极旧内核不会长高预留，行为退回本轮之前的潜在重叠）。
- 隐页停 RAF、零尺寸 resize，只有源码证据。
- 日期/太阳/副面与 3D 同源、DF/评分不随日期变：规则未改，仍需在适配视口下顺便核对。

## 主线程实看顺序

默认上海 0.40 m / 0° / 45%，复位全景。

1. 窄屏必须真到 **400×534**（不要用 500×671 代替；做不到就拍稳定最窄尺寸并按真实宽高命名）。禁止为压宽度去开 Chrome 设置或误进「删除浏览数据」。看画布、时间轴、评分分行是否互盖、是否可操作；可再展开「月份 / 节气」，确认后续控件下让且不挡画布。等待胶囊若折行，只记录，不为大号数字加码。
2. 再矮屏：约 620px 或更矮，且 `min-width:761px` 断点须真能用（例如 761×620）。开/关抽屉与展开年轴细节，确认不挡窗、电视、冬至光带，仍可操作。
3. 再 125%/150% 缩放或等效 visualViewport；按**真实 CSS 宽高**命名。
4. 桌面尽量 **1271×667**；达不到按真实宽高命名，不要用 1268×666 或 1262×650 冒充。同样开/关抽屉与年轴细节。
5. 再查无 WebGL 降级（优先用上面的 `WEBGL_lose_context`；构造失败用 Firefox `webgl.disabled` 或独立 `--disable-webgl` 进程）。
6. 再查播放时开/关热力：拖轴、切冬夏、改参数须立刻可理解；停播后画面质量应与改前一致。不得撰写 FPS 数字。

不要开始 07 / 08。不要为未测帧率回头改灯光或材质。
