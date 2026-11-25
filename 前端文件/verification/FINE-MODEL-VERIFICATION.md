# R4 细模最终交付验证 / 2026-11-25 17:23 Asia/Shanghai

## 已执行（非浏览器）

- `npm test`：35/35通过，含原28项与7项新纯几何测试。覆盖有限顶点/法线/实例矩阵、合并与几何预算、软垫面内部实际形变、地板/地毯/桌脚接触、植物房间边界、窗型材尺寸和真实空腔射线、窗墙比/百叶角极值更新。
- `npm run build`：TypeScript检查及Vite生产构建通过。保留Three分块约535.65kB的500kB体积警告；不是错误，未人为提高阈值掩盖。
- `npm run build:offline`：通过，根目录`SunCraft-离线演示.html`更新为960,669字节。最终包装为`/workspace/SunCraft-fine-model-20261125.zip`；旧视觉归档未覆盖。
- `node scripts/diagnostics/model-inventory.mjs`：纯几何实例化与实数统计，结果存于`design-notes/fine-model-inventory.json`。只覆盖新细模室内/新窗细节：52 Mesh、191,848展开三角形、13,383,240字节几何缓冲；不代表全场景、显存、DrawCall、FPS。
- `node scripts/diagnostics/sunlight-audit.mjs`：既有主要开口/遮挡数值回归一致，夏季82.24°无遮挡地面上限0%，冬季35.36°上限15.56%。该诊断不含家具、不是渲染截图、也不是DF或物理精度验收。
- HTTP健康检查：http://127.0.0.1:5173/ 返回200，原Vite PID200651保留运行。它是辅助电脑本机服务，不是用户Windows目录或公网部署。

## 最终实际浏览器验收（主任务反馈）

2026-11-25 17:23（Asia/Shanghai）收到标准浏览器实看结论：默认/冬至/沙发近景/窗框植物近景/窄屏均已查看，未见明显穿模、悬缝或破面；冬季真实百叶光带保留，窗外风景贴图确实已移除。相机操作未见明显卡顿，但未测FPS。仍为风格化程序化模型，并非照片级；针脚和叶脉偏淡，如实保留，不再进行代码或设计修改。

本执行者没有通过Shell/Playwright驱动浏览器，没有生成或改造截图。五张新验收图从主任务标准浏览器的真实工具输出路径逐字节复制到`verification/fine-model-final-review/`，逐文件SHA256与来源见其中`MANIFEST.json`。桌面图1920×1072；窄屏CSS400×810，工具真实图320×648，原样保存，不放大冒充原尺寸。历史`final-review`为细模前版本，不作为本轮验收依据。更早约1280×715/390×675只作历史记录；未声称1366×768或390×844已人工验收。

## 交付内容与边界

- 新包：`/workspace/SunCraft-fine-model-20261125.zip`，旧视觉包不覆盖。
- 包含当前应用源码/依赖锁/配置与启动脚本、35项测试代码、生产产物、离线HTML、README、设计记录、完整通过日志与五张真实新截图。
- 已通过测试/构建的原始日志复制于`verification/fine-model-build-records/`。本次只改文档、复制证据并包装，未改应用代码，按要求不重复耗时测试。
- 归档逐文件哈希清单为`verification/FINE-MODEL-PACKAGE-CONTENTS.json`，压缩后执行CRC及内容哈希校验。归档不包含node_modules、本地测试缓存或旧ZIP；开发依赖用`npm ci`安装，离线入口不需要安装。
- 源码仍在`/workspace/suncraft-implementation`；本机开发服务`http://127.0.0.1:5173/`保留。
- 演示/近似标签、接口联调状态和错误处理保留。物理精度、规范达标及60fps/100ms未验证。
- 用户指定Windows目录权限限制未解除，未访问、未重试复制；不声称已落地用户电脑。
