# 实测记录

测试日期：2026-11-25（Asia/Shanghai, UTC+8）。本记录是前端功能验证，不是物理算法/规范认证或 GPU 性能验收。

- `npm run build`：TypeScript 严格检查、Vite 7.3.8 生产构建通过。最终构建约 2.34 秒（辅助 Linux 环境）。Three.js 分包约 494.86 kB，业务/React 约 285.77 kB，GSAP 70.47 kB，CSS 28.30 kB（未压缩传输体积）。
- `npm run build:offline`：单文件构建通过，约 2.42 秒。
- `npm test`：16/16 通过。覆盖初值、房间/窗几何约束、DF 轴向/数值、演示模型趋势、优化保持城市与 WWR、不伪造可行性、非法响应拒绝、XML 转义与设计单元数据。
- `npm run test:browser`：10/10 通过，约 57.7 秒。Chromium 159 headless / SwiftShader 软件渲染。覆盖实际 WebGL 页面加载、季节切换、热力开关、滑块/城市/重置、寻优动画与取消、SVG 实际下载及 XML 解析、503 显式错误、390×844 手机页面无横向溢出、API 旧响应不覆盖新参数、异常矩阵拒绝、1366×768 短屏面板可达、file:// 完全离线自包含入口。每个用例均检查无未捕获 pageerror。
- `npm audit --audit-level=high`：0 vulnerabilities。
- 截图经人工阅读：`desktop-summer.png`、`desktop-winter-heat.png`、`desktop-1366x768.png`、`mobile.png`、`offline-file.png`；SVG 实际下载样本 `design-sheet.svg`。

测试过程中发现并修复：GSAP `_gsap` 循环缓存进入 React 参数状态导致渲染失败；短屏右侧面板超出底部的问题。最终重跑均通过。

尚未验证：用户电脑实际 GPU/浏览器表现、Windows 本机 npm 安装/构建、真实 FastAPI 联调、60fps 或 100ms 目标、物理精度/规范符合性。截图中的演示数据和 3D 几何阴影不应当被解读成校准后的物理计算。

Playwright 启动的辅助开发服务器随测试退出，没有在用户电脑启动服务。默认运行端口 127.0.0.1:5173；真实进程状态以交付说明为准。
