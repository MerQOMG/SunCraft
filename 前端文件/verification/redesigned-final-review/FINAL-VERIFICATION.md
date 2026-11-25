# SunCraft P0—P3 最终验证与交付边界

2026-11-25，Asia/Shanghai。本次仅复制真实证据、离线转换导出、更新文档与归档；不再改源码或美术。

## 逐阶段真实审视

- P0构图：主任务实看默认已不再是高俯视厚底座的楼盘模型；室内观察成立，原全景保留作分析。冬季光带保留。
- P1大形/材质：薄垫窄扶手、茶几细腿、地毯改善明显，未见新穿模；不以继续加面数冒充质量。
- P2光照：白顶、家具阴面与冬季光带改善，AO未见明显黑圈脏边，全景热力正常。一次首次相机操作后截图10秒绘制超时，重试/再旋转正常。
- P3界面及最终全流程：主任务标准浏览器真实操作确认夏冬/热力/全景正常，标题日期可读，侧栏滚动后剖面图例无重叠；Tab、挑檐0.40→0.45m、寻优完成、重置实际操作成功，最后恢复默认。没有再出现10秒超时；窗口调整时画布短暂空白后恢复。未测FPS，不能称性能已证。

## 最终实际尺寸与截图

最终桌面实测 **1274×696 CSS**。窄屏 **400×810 CSS**，125%缩放时整页图320×648像素。七张原文件像素：

| 文件 | 原图像素 |
| --- | --- |
| summer-default.png | 1274×696 |
| winter-solstice.png | 1274×696 |
| daylight-heatmap.png | 1274×696 |
| analysis-view.png | 1274×696 |
| mobile-400x810css.png | 320×648 |
| mobile-section-400x810css.png | 400×810 |
| desktop-restored-default.png | 1920×1072 |

窄剖面图与恢复大屏图按工具真实文件像素逐字节复制，不为统一图幅改造。恢复大屏CSS视口未另提供，不从像素反推。来源及SHA256见`screenshot-provenance.json`。历史约1280×715 CSS/390×675 CSS不冒充当前最终尺寸；未测1366×768/390×844。

## SVG：真实下载存在；离线预览与浏览器验收分开

- 实际文件`/home/box/Downloads/夏遮冬透-建筑表皮光热设计单 (1).svg`存在，6,002字节，已原样复制为`downloaded-design-sheet.svg`。包含19:35:03 Asia/Shanghai时间、默认0.40m/0°/45%、夏82.2°/冬35.4°及演示警示。不是夹具。
- Chrome下载成功，但随后`file://`打开报`ERR_FILE_NOT_FOUND`。未反复重试，不解释为已成功浏览器渲染。
- 用CairoSVG 2.9.1直接转换原SVG，初次默认字体的中文缺字；诊断图保留为`diagnostic-cairo-default-missing-cjk.png`。CairoSVG的字体代码只取font-family首项Inter，未实现浏览器式CJK字形回退，环境Inter不含中文。
- 转换进程单独设置`FONTCONFIG_FILE=fontconfig-offline-preview.conf`，将Inter选择为现有`Noto Sans CJK SC`；**没有修改SVG字节、没有修改系统字体/全局配置、没有修改项目代码**。同一实际下载生成`downloaded-design-sheet.png`（1120×1328），执行者通过Read检查：中文正常可读，剖面/参数/页脚分区未见重叠截断，角度与单位正常。字体选择与浏览器不完全相同，因此仅证明此离线字体条件下的矢量布局，不等于Chrome/file渲染通过。
- 主任务可直接Read该PNG；最终导出跨浏览器/字体渲染仍应单独核验。

离线转换工具只装在包外辅助虚拟环境`/workspace/suncraft-svg-tools`，没有系统级安装或新增项目依赖。配置文件随证据保留；重现需本机具有CairoSVG及Noto Sans CJK SC。

## 测试、构建及产物

- P3源码已有 **62项纯测试通过（原54+8）**，日志`../p3-interface/tests.txt`。TypeScript及生产构建通过，日志`production-build.txt`；离线构建通过，日志`offline-build.txt`。本次源码未改，按要求不重复全测。
- 当前离线HTML为根目录`SunCraft-离线演示.html`，1,252,525字节；最终源码/测试/脚本/离线哈希见`final-code-artifact-hashes.json`。生产dist也入包，依赖node_modules与辅助转换虚拟环境不入包。
- 生产分包仍有app约604.70kB、Three约538.97kB超过500kB警告。无浏览器自动化、GPU/FPS、60fps/100ms或真实物理精度承诺。
- 开发服务器保留`http://127.0.0.1:5173/`，原PID 200651；只监听本机，不是公网部署。

## 必须如实保留的限制

模型为程序化风格化场景，不是照片级；针脚/叶脉等细节在正常视距偏淡。窗外风景贴图确实移除。太阳正午几何及真实屋顶/百叶遮挡保留；冬季光带不靠假光斑。窗洞面光/首反射/AO为渲染近似，非真实GI校准；DF/寻优/GB指标仍为明确演示或待联调API数据，非规范认证。API契约、80ms调度、竞态/错误提示、导出/键盘/窄屏保持。

用户指定Windows目录仍未落地：此前目录根权限拒绝尚未解除；未重试访问/复制，未绕过。此次新包`/workspace/SunCraft-redesigned-20261125.zip`与旧视觉/细模包并存，不覆盖旧交付冒充更新。
