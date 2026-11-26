# 夏遮冬透 · SunCraft

南向客厅的遮阳、采光与方案评分工作台。支持调整城市、挑檐、百叶与窗墙比，查看三维预览、冬夏指标、实时评分和设计单。

## 打开程序

**直接双击根目录 `夏遮冬透.html`，或运行 `start-demo.cmd`。** 离线工作台在浏览器中按当前参数实时计算，不需要安装 Node.js 或 Python。

需要 FastAPI 后端时，运行根目录 `start-dev.cmd`。它会检查环境、补齐依赖并启动前端与后端，成功后打开 **http://127.0.0.1:5174/**。保留启动窗口，按 Ctrl+C 停止。要求 Node.js 22.12+、Python 3.11+；日志在 `.cache/run/`。

如浏览器限制本地 HTML，电脑已有 Node.js 时可运行 `前端文件/start-preview.cmd`，再打开 **http://127.0.0.1:5175/**。这个 HTTP 入口使用同一份根目录 HTML 和本地计算模型。

macOS / Linux 开发启动：`bash start-dev.sh`。

## 目录

```text
SunCraft/
├── 夏遮冬透.html              唯一的离线成品入口
├── start-demo.cmd             用默认浏览器打开离线入口
├── start-dev.cmd / .ps1       Windows 前后端启动器
├── start-dev.sh               macOS / Linux 前后端启动器
├── 前端文件/
│   ├── src/
│   │   ├── App.tsx / main.tsx 应用与入口
│   │   ├── components/       三维场景、剖面和日期控件
│   │   ├── hooks/            模拟请求与状态管理
│   │   ├── styles/           页面与日期控件样式
│   │   ├── modeling/         家具、窗框与构件几何
│   │   ├── scoring/          评分规则、报告和评分组件
│   │   └── localEngine.ts    本地解析几何与采光计算
│   ├── tests/                单元与浏览器回归
│   │   └── fixtures/         后端基准、旧接口与示例数据
│   ├── scripts/              构建与预览脚本
│   └── public/               运行所需静态资源
├── backend/
│   ├── suncraft/             API、物理近似、评分与寻优
│   └── tests/                后端测试
└── docs/架构与维护.md          数据流、维护与检查说明
```

`.venv/` 和 `前端文件/node_modules/` 是本机开发依赖。`.cache/`、`dist/`、`test-results/` 等为可再生成的本地产物，均不提交。

## 前端开发与检查

在 `前端文件` 目录中运行：

```powershell
npm ci
npm test
npm run build
npm run build:offline
npm run format:check
```

- `npm run dev`：前端 5174，`/api` 代理到后端 8001。
- `npm run preview`：5175，通过 HTTP 预览根目录离线工作台。
- `npm run build:offline`：只更新根目录 `夏遮冬透.html`，不再生成第二份重复入口。
- `npm run format`：统一前端代码、测试和脚本格式。
- `npm run test:browser`：浏览器回归。首次需要 `npx playwright install chromium`；已有 Chrome 时也可设置 `SUNCRAFT_BROWSER_PATH` 指定可执行文件路径。

## 后端与评分

后端启动、模型与接口细节见 [backend/README.md](backend/README.md) 和 [backend/SCORING.md](backend/SCORING.md)。运行后端测试：

```powershell
cd backend
..\.venv\Scripts\python -m pytest -q
```

更新后端评分规则或模型后，在根目录运行：

```powershell
.venv\Scripts\python backend\export_client_reference.py
```

这会导出前端评分规则和后端测试基准，再运行前端测试检查两端一致性。

本地与后端评分均基于当前方案的冬夏设计工况。日期轴控制太阳几何预览，不重新计算当天或全年评分。模型输出用于方案比较，尚不构成实测精度或规范认证。
