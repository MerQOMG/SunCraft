# SunCraft · 夏遮冬透后端

Python、FastAPI 和 NumPy 实现的典型客厅遮阳与采光模拟服务。房间宽 5.4 m、进深 6.0 m、高 3.0 m。计算在本机完成。实施计划见 [PLAN.md](PLAN.md)。

## 启动

在本目录下运行。推荐 Python 3.11 或更高版本。

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn suncraft.api:app --host 127.0.0.1 --port 8000
```

macOS 或 Linux 使用 `.venv/bin/python` 代替 `.\.venv\Scripts\python`。服务启动后可打开 [交互文档](http://127.0.0.1:8000/docs) 或 [OpenAPI 契约](http://127.0.0.1:8000/openapi.json)。前端可从独立端口发送 JSON 请求。

## 三条接口

| 方法和路径 | 输入 | 返回 |
| --- | --- | --- |
| GET `/api/presets` | 无 | 四个城市及纬度、默认输入、参数范围、房间和遮阳尺寸、两个采光阈值 |
| POST `/api/simulate` | 当前设计，空对象使用上海默认值 | 冬夏太阳角度、五个指标、24 × 24 的 DF 矩阵、两季剖面光线坐标 |
| POST `/api/optimize` | 与模拟相同，挑檐与百叶表示优化前的设计 | `before` 与 `after` 各含完整参数和指标，另附搜索统计及状态 |

| 输入字段 | 默认值 | 取值约定 |
| --- | --- | --- |
| `city` 或 `latitude` | 两者省略时使用 `shanghai` | 二选一。城市支持 `shanghai`、`beijing`、`guangzhou`、`harbin`。自定义纬度以北为正，范围 (−90°, 90°) |
| `orientation_deg` | 180 | 立面朝外的法向方位角，正北为 0°，顺时针计，范围 0°–360° |
| `window_to_wall_ratio` | 0.50 | 窗面积除以整面外墙面积，范围 0.10–0.75 |
| `overhang_depth_m` | 0.40 | 窗顶挑檐水平出挑，范围 0–1.60 m |
| `louver_tilt_deg` | 0 | 水平百叶外缘向下的倾角，范围 0°–75° |

字段名错误、类型错误、未知城市、位置冲突或数值越界返回 HTTP 422。合法输入在固定窗墙比下无法实现采光目标时，寻优接口返回 HTTP 200、`status="infeasible"`、`after=null` 及最高可达面积比例。

在另一个 PowerShell 窗口中可直接完成一次优化并重放结果。

```powershell
$api = 'http://127.0.0.1:8000/api'
$design = @{city='harbin'; window_to_wall_ratio=0.50; overhang_depth_m=0.40; louver_tilt_deg=0}
$result = Invoke-RestMethod "$api/optimize" -Method Post -ContentType 'application/json' -Body ($design | ConvertTo-Json)
$result.before.metrics
if ($result.status -eq 'optimal') {
    $result.after.metrics
    $simulation = Invoke-RestMethod "$api/simulate" -Method Post -ContentType 'application/json' -Body ($result.after.parameters | ConvertTo-Json)
    $simulation.svg_rays
}
```

## 前端读数与坐标

- `solar_angles` 中的 `summer_noon_alt/az` 与 `winter_noon_alt/az` 分别表示高度角与方位角，单位为度。所有城市使用当地**真太阳正午**。天顶方位角为 `null`。南半球的当地夏至取十二月至日，赤道采用六月为夏至的命名。
- `summer_shading_rate` 是遮住的直射窗面积比例。`winter_solar_gain_rate` 是相对于同一未遮阳窗的冬季直射透过比例。两者均为 0–1。太阳低于地平线、位于立面背后或与窗面平行时，对应指标为 0，季节的 `*_incident` 为 `false`，光线列表为空。
- `heatmap_grid[进深行][横向列]` 单位为 **DF 百分数**，值 2.0 表示 2%。第 0 行最近窗，每行由立面室外朝室内观察时的左侧排向右侧。取样点是等面积网格中心。用矩阵中 DF ≥ 2.0 的点数除以 576 得到 `daylight_compliance_rate`。至少 461 点通过时，`is_gb_compliant` 为真。
- 剖面点 `[x,z]` 以米计，窗位于 x=0，x 正向深入客厅，z 从地板向上。每季最多返回两条代表线。遮挡线止于第一个挡光构件。透过线沿最高可透光边界，从窗外经 `window_entry` 到达地面或后墙。SVG 可映射为 `(x0 + scale*x, y0 - scale*z)`。
- `svg_rays.summer_blocked` 表示夏季有直射且整窗被遮蔽。`winter_hit_depth` 等于 `metrics.winter_penetration_m`，表示冬季光线沿剖面进入房间的最远距离，最大 6.0 m。

## 模型与寻优

**直射几何。** 二至日太阳赤纬取 ±23.44°。在真太阳正午，高度角等于 90° 减去纬度与赤纬之差的绝对值。将太阳方向投影到立面法向剖面后，计算挑檐和每片百叶在窗口上的投影并集。窗宽固定 4.86 m、窗台高 0.45 m，窗高由窗墙比反推。叶片自窗顶起每 0.45 m 一片，弦长 0.06 m。构件沿立面横向连续，计算忽略两侧绕射和有限宽度的侧向漏光。[NOAA 太阳位置公式](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)

**漫射采光。** 假设均匀亮度天空，解析积分矩形窗在地板点的直接采光分量。间接分量使用房间面积加权的平均反射率，玻璃可见光透射率取 0.72，地面、墙面、顶棚反射率取 0.30、0.65、0.80。用 32 个加权天空方向估算遮阳后整窗的平均漫射透过率，再按该比例折减全室 DF。家具、外部遮挡及天气变化未建模。`is_gb_compliant` 使用方案指定的 GB 50033 演示阈值。工程精度尚未通过实测或 Radiance/DIALux 标定。

**帕累托选择。** 枚举 41 个深度 × 25 个倾角，共 1,025 组。网格外的当前设计也参与竞争。固定纬度、朝向和窗墙比，筛出达标面积 ≥ 80% 的候选，保留夏季遮挡和冬季得热双目标的非支配点，再选取到理想点 (1,1) 欧氏距离最近的方案。同分时依次优先采光达标比例较高、出挑较浅、倾角较小的设计。`search.pareto_objective_count` 统计前沿中不同的目标值组合。

**上海默认场景。** 夏至高度角约 82.24°，0.40 m 挑檐在窗面投下约 2.94 m 高的阴影，超过默认窗高 1.67 m，初始夏季遮挡率为 100%。冬至高度角约 35.36°，直射透过率约 75.3%，光线最深进入 2.58 m。若路演需要观察遮挡率从部分遮挡上升，可使用哈尔滨预设，默认夏季遮挡率约 71.5%。

## 验证与性能

```powershell
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m benchmark
git log --oneline
```

用例覆盖四城预设、朝向与天顶边界、极夜、热力矩阵、光线几何、阴影区间并集、非法参数、跨域请求及寻优可行性。寻优结果与单组模拟逐一枚举核对，并通过模拟接口重放。

以下为一次 Windows / Python 3.14.7 / NumPy 2.5.3 的上海默认场景实测。每项预热 10 次，串行采样 100 次。ASGI 测量包含请求验证、路由、响应序列化和客户端 JSON 解析。测试环境限制回环 TCP，接口耗时为进程内数据，Uvicorn 另行验证了实际端口监听与正常关闭。

| 路径 | 引擎 P50 / P95 | ASGI 接口 P50 / P95 |
| --- | --- | --- |
| 模拟 | 0.14 / 0.26 ms | 1.85 / 2.33 ms |
| 寻优 | 4.19 / 5.60 ms | 6.77 / 8.96 ms |
