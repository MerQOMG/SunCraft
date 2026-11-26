# 夏遮冬透 · SunCraft

面向南向居住空间的遮阳与采光设计演示。你可以在三维场景里调整窗口、挑檐和百叶，查看冬夏采光与热舒适评分。

- 前端：Vite + React + Three.js（源码在 `前端文件/src/`）
- 后端：FastAPI + 既有解析几何与采光模型（源码在 `backend/suncraft/`）

本仓库可以直接打开源码阅读。

## 当前入口（请先看这里）

**双击仓库根目录的 `夏遮冬透.html` 即可打开程序。** 不需要安装 Node.js 或 Python，克隆或下载本仓库后别人也可以直接这样打开。

这是完整的前端演示：三维场景、参数调节和页面交互都可以用。评分与寻优使用内置的演示 / 近似数据，不是实时后端计算结果。

如果要把评分接到真实的 FastAPI 后端，请再按下面的「开发服务启动」操作，然后打开 http://127.0.0.1:5174/ 。

请不要双击 `start-demo.cmd`，也不要把旧的 5173、8000 端口当作当前入口。`前端文件/SunCraft-离线演示.html` 与根目录的 `夏遮冬透.html` 是同一份离线页，建议统一打开根目录这一份。

## 开发服务启动（可选，真实后端评分）

开发服务启动后：

- 请打开：**http://127.0.0.1:5174/**
- 前端开发服务器固定在 `127.0.0.1:5174`（不会自动换端口）
- 后端固定在 `127.0.0.1:8001`
- 页面里的 `/api` 请求由 Vite 代理到 `http://127.0.0.1:8001`

### 环境依赖

请先安装：

- [Node.js](https://nodejs.org/) 22.12 或以上，或 24 LTS（安装时必须带 npm）
- [Python](https://www.python.org/downloads/) 3.11 或以上（Windows 安装时勾选 “Add python.exe to PATH”）

### Windows 一键启动

1. 确认已经安装上面的 Node.js 和 Python。
2. 把本仓库放到任意文件夹并进入仓库根目录（能看到本 `README.md`、`backend` 和 `前端文件`）。
3. 双击根目录的 `start-dev.cmd`，或在该目录打开命令提示符后运行：

```bat
start-dev.cmd
```

脚本会自动检查环境、在缺少依赖时创建 `.venv` 并安装后端包、在缺少 `前端文件\node_modules` 时执行 `npm ci`，然后启动后端和前端。成功后用浏览器打开 http://127.0.0.1:5174/ 。

如果提示 5174 或 8001 已被占用，请先关闭占用该端口的程序再重新运行。脚本不会擅自更换端口。

#### Windows 手动启动（可选）

在仓库根目录打开命令提示符：

```bat
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt
```

再打开另一个命令提示符，进入 `前端文件`：

```bat
cd 前端文件
npm ci
```

以后每次运行都要开两个窗口。根目录这一边：

```bat
set SUNCRAFT_DEV_ENTRY=1
.venv\Scripts\python -m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8001
```

`前端文件` 那一边：

```bat
cd 前端文件
npm run dev
```

如果 `python` 找不到，把创建虚拟环境的 `python` 换成 `py -3`。

### macOS / Linux 启动

在仓库根目录执行：

```sh
chmod +x start-dev.sh start-linked-dev.sh
./start-dev.sh
```

`start-linked-dev.sh` 与 `start-dev.sh` 相同。脚本同样会检查 Node / Python，缺少依赖时自动创建 `.venv`、安装后端包，并在 `前端文件` 执行 `npm ci`，然后启动 8001 与 5174。

浏览器打开 http://127.0.0.1:5174/ 。结束时在该终端按 Ctrl+C。

#### macOS / Linux 手动启动（可选）

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd 前端文件 && npm ci && cd ..

# 终端 1，仓库根目录
SUNCRAFT_DEV_ENTRY=1 .venv/bin/python -m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8001

# 终端 2
cd 前端文件
npm run dev
```

## 目录结构

```
.
├── README.md                   本说明（请从这里开始）
├── 夏遮冬透.html               当前入口：双击即可打开（无需安装环境）
├── start-dev.cmd               Windows 开发服务启动脚本（真实后端）
├── start-dev.ps1               由 start-dev.cmd 调用
├── start-dev.sh                macOS / Linux 开发服务启动脚本
├── start-linked-dev.sh         与 start-dev.sh 相同
├── start-demo.cmd              旧入口（8000 端口），不要作为当前方式
├── 前端文件/                   前端工程
│   ├── src/                    前端源码（页面、三维场景、评分抽屉等）
│   ├── public/                 静态资源
│   ├── index.html              Vite 入口 HTML
│   └── SunCraft-离线演示.html  与根目录入口相同的离线页构建结果
├── backend/                    后端工程
│   ├── suncraft/               后端源码（API、仿真、评分）
│   ├── tests/                  后端测试
│   ├── requirements.txt        Python 依赖
│   └── README.md               后端计算说明
└── docs/过程记录/              开发过程笔记与核对材料，不是运行所必需
```

克隆或下载本仓库后，不必上传或提交 `.venv`、`前端文件/node_modules` 等本地依赖目录。只双击 `夏遮冬透.html` 时也不需要安装这些依赖。

## 接口说明

开发服务启动后，前端默认通过同源 `/api` 访问后端。常用接口：

| 入口 | 用途 |
| --- | --- |
| `GET /api/presets` | 四个城市与 2% 采光系数阈值 |
| `POST /api/simulate` | 当前设计的夏冬指标、剖面、24×24 采光矩阵和四维十项评分 |
| `POST /api/optimize` | 固定城市和窗墙比，按后端规则寻优，返回推荐参数及前后两份完整仿真 |
| `/engine/docs` | 既有计算引擎的原生接口文档 |

后端采用已有的解析几何与采光模型。前端三维场景的窗框、百叶和实时阴影用于辅助预览，计算口径见 [后端说明](backend/README.md)。数值为现有后端模型输出，不是实测、精度认证或规范结论。双击 HTML 打开时使用内置演示数据，同样不是实测或规范结论。

采光达标面积至少为 80% 才能推荐设计。如果页面在寻优时显示 HTTP 409，表示当前窗墙比的所有候选都无法达标，可以提高窗墙比后重试，例如从 0.25 调到 0.45。

日期轴上的太阳位置按所选日期的真太阳时 12:00 计算，用于预览；冬夏评分、采光系数和寻优在开发服务模式下仍使用后端的设计工况，不会随日期播放重新计算。
