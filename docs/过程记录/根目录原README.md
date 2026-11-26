# 当前收口说明（请先读这里）

2026-11-26 Asia/Shanghai。完整收口说明见 [integration-notes/freeze/HANDOFF.md](integration-notes/freeze/HANDOFF.md)。

**请打开 http://127.0.0.1:5174/** ，用根目录 `start-linked-dev.sh`（后端 127.0.0.1:8001）。不要把 `前端文件/SunCraft-离线演示.html`、`/legacy-demo`、`start-demo.cmd` 的 8000 端口、旧 5173 或历史 zip / 阶段备份当作当前交付。后端公式未改，未推送合并，未动用户电脑。

以下为各阶段当时写入的过程记录，以 freeze 说明为准。

## 当前追加：抽屉信息层整理（2026-11-26，Asia/Shanghai）

开发入口仍为 http://127.0.0.1:5174/ 。抽屉内以「评分细则 / 日期几何 / 两至工况」三个页签区分来源：日期图来自前端NOAA真太阳12:00几何；评分、DF和两至代表射线来自原接口，不随日期播放重计。两至图前置，无需先滚过全部评分；广州适用性说明、请求错误和寻优/取消共用保留。全部原SVG保持挂载供原快照导出，未改变导出算法。

本轮仅App抽屉装配、ScoreDrawer和其CSS；主画布/时间轴布局、已有字号、全景、材质/光源/计算口径、API及后端未变。仅定向类型/SSR语义/模块HTTP检查，无整套测试或构建；新布局与键盘滚动仍待正常浏览器实看。阶段记录及可逆备份索引见 `integration-notes/report-info/HANDOFF.md`。旧离线HTML未更新，不能当本轮效果。

# 夏遮冬透 · SunCraft

## 当前材质小批精修（待同尺寸实看）

继续 **http://127.0.0.1:5174/**。只处理电视背壳哑光石墨、原程序胡桃木的色理/线性粗糙度、窗框粉末涂层响应；没有改房间/家具网格、相机/光源/太阳、评分API/日期轴/布局。新增256²纹理一张，未下载资产或加pass；不声称已视觉提升。有限检查和三项自查见[材质交接](integration-notes/materials-refine/HANDOFF.md)。光影上一轮已实看收口，不再调增；未整套测试、构建或自行浏览。

## 当前光照/接触阴影小批校准（待正常浏览）

仍 **http://127.0.0.1:5174/**。本轮仅调整窗光/弱环境光配比、窗光色温和小半径接触AO，曝光/真实太阳/共享几何/构图/UI/后端不动，北侧无假直射，地平线以下日光填充明确关闭。是渲染近似，非真实GI；没有新灯/pass、构建、全测或自行浏览。已准备夏/冬/春分或广州同尺寸对照任务，见[光影交接](integration-notes/lighting-refine/HANDOFF.md)。之前构图实拍变大/不挡/边界通过是主线程真实结果，播放工具超时、部分剖面全可读、ReadPixels警告与Network仍保留限制。

## 当前全景取景阶段（待同尺寸正常浏览对照）

仍是 **http://127.0.0.1:5174/**，完全相同全景方向，28°长焦+实际包络fit；手动Orbit后resize不强制复位。宽桌面释放真实画布高度，报告打开预留360px列不盖右窗；手机保留R2下方流。没有改物理尺寸/家具/几何/太阳/日历/API/灯光材质，投影报告不是视觉验收。详见[全景取景交接](integration-notes/panorama-framing/HANDOFF.md)。

真实下载6与8已用本机librsvg/Cairo/Pango离线转换全图PNG，Noto Sans/CJK fallback，非浏览器截图；本执行器Read未见两图/参数/页脚重叠。原SVG字节不变。

检测旧依赖软链目标失效且服务停止后，仅按原上传锁恢复本副本依赖（禁安装脚本、无升级锁/全局），再复用已有脚本恢复5174/8001；不再依赖旧共享node_modules。当前未构建/全测/本轮浏览验收。

## 当前全年R2修复（待正常浏览复验）

入口仍 **http://127.0.0.1:5174/**。播放导出改为同步停钟、清空过期tick资格、提交后核对同一日期快照；按钮获焦/按下提前暂停。倍速无障碍名动态显示4/8/16日每秒。时间轴常用行紧凑常显，月份/节气/详情展开，按实际高度预留评分与画布；日期剖面增加可读高度并修定位。

真实旧下载(6)已原字节放在[本地HTTP预览](http://127.0.0.1:5174/verification/annual-r2/download-6-original.svg)，日期4/11，非新导出或夹具。没有外网发布。本轮未改后端、Scene/光照/数学、API/取消机制，没有构建/全测/自动浏览器。定向检查及有限hook真实HTTP证据详见[全年R2交接](integration-notes/annual-r2/HANDOFF.md)；浏览超时根因不能凭静态代码定论，修复后仍须主线程实际激活导出复验。

## 当前2026全年真太阳正午预览（待本轮浏览验收）

**继续使用 http://127.0.0.1:5174/ 。** 新增2026日期/月/官方节气/播放倍速，日期是唯一状态源，三维太阳、当前日期剖面与导出同源。日级NOAA/Meeus公开数学，不做冬夏插值；仅真太阳时12:00，非北京时间，无日内/任意年份或全年性能承诺。本年冬至12月22日。

后端分数/DF/寻优仍冬夏设计工况，日期播放不重算它们。广州夏至南窗无正面入射但原遮阳贡献0/20、总分44.416552，是原后端适用性口径待校核；前端仅说明，不篡改贡献增分。上海默认完整JSON仍等于此前91.14974。

本阶段未改任何后端、共享建筑几何或原全景，未构建/全测/自动浏览器。旧离线HTML没有更新，不可当新成果。定向类型/数学/两个真实HTTP及SVG XML检查见[全年预览交接](integration-notes/annual-preview/IMPLEMENTATION-AND-HANDOFF.md)。需要主线程实看日期播放、双图、窄屏与Network后再结论；没有FPS或物理精度验证。

## 当前几何统一补充（源码入口，待本轮浏览验收）

5174已使用Studio透传的既有room元数据；3D/型材/百叶/补光/剖面/设计单共享几何。后端计算文件未改，默认完整模拟JSON与此前相等（91.14974）。缺几何契约明确暂停3D，不回退旧4.4m；沙发框线是后端假定占地，不是实体家具受光结论。**理想几何对齐不等于物理精度验证。**

当前8001开发首页307转向5174；旧HTML仅作为`/legacy-demo`历史演示保留，未构建或覆盖。直接复现命令请在原uvicorn命令前加`SUNCRAFT_DEV_ENTRY=1`（Linux），合并启动脚本已包含；不设置时保留原离线入口行为。详见[integration-notes/STEP0-GEOMETRY-UNIFICATION.md](integration-notes/STEP0-GEOMETRY-UNIFICATION.md)。

本轮仅定向静态/小型纯几何/真实HTTP探针，未跑整套测试或构建，未自行浏览器。下面“8001首页旧HTML”等文字是23:26首轮状态，当前以此补充记录为准。

## 当前第0步联调入口（上传副本，2026-11-25 Asia/Shanghai）

**请打开 http://127.0.0.1:5174/ ，不是旧5173，也不是8001首页。** 当前源码HTTP入口默认真实API，同源`/api`由Vite代理到本包既有`suncraft.demo:app`的8001。API错误不自动退演示。默认方案已从后端实返91.14974分；88.4只会在用户显式选择演示时显示。数值为现有后端模型输出，不是实测、精度或规范认证。

本副本唯一源为用户23:14上传包；未改用户电脑、后端公式或模型美术。包无`.git`，不能确认分支/HEAD。保留原包、逐文件基线与HTTP证据。详见[integration-notes/STEP0-INTEGRATION.md](integration-notes/STEP0-INTEGRATION.md)。**本步只做静态检查和最小真实HTTP/adapter连通；没有运行全套测试、构建或浏览器验收。** 以下8000启动方式是上传包原有离线HTML入口，未重新构建，仍需手动选API；不要混为当前源码入口。

当前盒上依赖已就绪，可在项目根目录运行（先停止现有5174/8001服务，勿动历史5173）：

```sh
SUNCRAFT_PYTHON=/workspace/suncraft-upload-20261125-2314/runtime-env/bin/python ./start-linked-dev.sh
```

独立环境重现时：创建Python虚拟环境并`pip install -r backend/requirements.txt`；在`前端文件`用Node（符合Vite要求，当前实际Node24.22.1）执行`npm ci`。**当前node_modules已按上传原锁文件局部恢复，旧失效软链另存；未复制旧源码。移出本电脑仍需npm ci。** 然后分两个终端启动：

```sh
# 项目根目录，使用已安装requirements的Python
python -m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8001
# 另一个终端
cd 前端文件
npm run dev -- --port 5174 --strictPort
```

默认后端代理目标8001，可用`SUNCRAFT_API_TARGET`配置Vite代理；也可在页面设置中显式修改API基址。不要把`suncraft.api:app`原生引擎直接当成Studio前端契约；适配器已挂载于`demo:app`，原生引擎在`/engine`。Windows原有`start-demo.cmd`保留未动，本步未在用户电脑验证。

## 原有运行整合演示（上传基线保留）

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
