# 夏遮冬透 · SunCraft

## 运行整合演示

Windows 安装 64 位 Python 后，解压整个目录，双击根目录的 `start-demo.cmd`。启动器在项目内创建虚拟环境。下载的演示包含 Windows x64、CPython 3.12 和 3.14 的离线依赖。Git 仓库版首次运行从 PyPI 安装依赖。

1. 终端显示 Uvicorn 已启动后，打开 <http://127.0.0.1:8000/>。
2. 点击右上角「连接设置」，数据模式选择「FastAPI 后端」，保留地址 `http://127.0.0.1:8000`，点击「应用连接设置」。每次刷新都需要重新选择。底部状态栏会显示「API 模式」。
3. 使用默认上海方案，打开「采光热力」、切换冬至，点击评分查看四个维度。展开「当前模拟指标与建筑剖面」可以看到 24 × 24 采光矩阵说明，以及「一键寻优」前后的遮阳率。切换城市或拖动滑块会重新计算。结束时在终端按 Ctrl+C。

macOS、Linux 或已有 Python 环境可以在仓库根目录运行以下命令。后端需要 Python 3.10 及以上版本。

```sh
python3 -m venv .venv-demo
. .venv-demo/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8000
```

## 接口与计算

首页直接提供仓库内的 `前端文件/SunCraft-离线演示.html`。页面与 API 共用端口，演示运行时无需 Node.js。前端自带的近似演示模式也可以从连接设置中选择。

| 入口 | 用途 |
| --- | --- |
| `GET /api/presets` | 四个城市与 2% 采光系数阈值 |
| `POST /api/simulate` | 当前设计的夏冬指标、剖面、24×24 采光矩阵和四维十项评分 |
| `POST /api/optimize` | 固定城市和窗墙比，在 37 个挑檐深度、81 个百叶角度的组合中按后端规则寻优，返回推荐参数及前后两份完整仿真 |
| `/engine/docs` | 既有计算引擎的原生接口文档 |

后端采用已有的解析几何与采光模型。前端三维场景的窗框、百叶和实时阴影用于辅助预览，计算口径见 [后端说明](backend/README.md)。采光达标面积至少为 80% 才能推荐设计。如果页面在寻优时显示 HTTP 409，表示当前窗墙比的所有候选都无法达标。可以提高窗墙比后重试，例如从 0.25 调到 0.45。
