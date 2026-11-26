# HTTP 一次复现（非浏览器 UI）

时间：2026-11-26，Asia/Shanghai。对 http://127.0.0.1:8001 直连，不经过前端界面。

## 409 寻优不可行

请求：`POST /api/optimize`，上海预设精确纬度 31.2，挑檐 0.4 m，百叶 0°，窗墙比 0.25。
响应：HTTP 409，约 0.032 s。
正文见 `optimize-409-wwr025-shanghai.json`：

```json
{"detail":{"reason":"daylight_target_unreachable","max_daylight_compliance_rate":0.5763888888888888,"required_daylight_compliance_rate":0.8}}
```

前端 `api.ts` 既有映射（本轮未改）将生成：

> 当前窗墙比下没有满足采光目标的候选（最大面积比例57.6%，目标80.0%）；请调整窗墙比后重试。HTTP 409

注意：第一次误用纬度 31.2304，服务返回 HTTP 422「City and latitude must match a published preset」，不是 409。必须以预设精确纬度复现。

## 422 参数越界

请求：`POST /api/simulate`，上海 31.2，挑檐 1.81 m（上限 1.8）。
响应：HTTP 422，约 0.001 s。正文见 `simulate-422-overhang181.json`：

```json
{"detail":[{"loc":["body","overhang_depth_m"],"msg":"Input should be less than or equal to 1.8","type":"less_than_equal"}]}
```

前端既有映射（本轮未改）将生成：

> 后端响应 HTTP 422：Input should be less than or equal to 1.8

（保留后端英文校验句，本轮未改文案。）

## 超时

未复现。前端 `api.ts` 在 8 秒后 abort，若非用户取消则抛出「后端响应超时（8 秒），请检查服务」。为不挂起正在给主线程准备的 8001 服务，本轮不做超时实锤。
