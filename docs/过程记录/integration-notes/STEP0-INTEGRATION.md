# 第0步：上传副本前后端真实接通记录

记录时间：2026-11-25 23:26:01 Asia/Shanghai。本步完成静态与最小真实HTTP/前端adapter连通；等待主任务正常浏览器验收，**不是全流程/视觉/精度验收**。

## 唯一源与可逆边界

- 原包：`/workspace/suncraft-upload-20261125-2314/SunCraft-original-upload-20261125-2314.zip`
- SHA256：`a73998503e8b9e2a60ad0a09b4586ac6d1ff205ce5c6fdd3f3a653bfdf0ef20f`
- 工作副本：`/workspace/suncraft-upload-20261125-2314/extracted`
- ZIP227项，展开20,092,001字节；安全检查未发现路径穿越/重复异常/符号链接逃逸，原包保留。前后端入口、源码、依赖声明、原离线HTML齐全；无`.git`，所以分支/HEAD/remote不作推断。
- 包外`archive-inspection.json`、`source-baseline-sha256.json`为基线；本目录`BASELINE-DIFF.json`、`step0-source.diff`记录现有文件改动。未删除上传文件，后端文件逐个SHA256保持原值；无提交/推送/合并，无用户电脑读写。

## 实改范围

1. `前端文件/src/api.ts`：HTTP源码默认API、基址当前origin；file离线/显式mock仍演示；保留配置覆盖。错误体解释409无可行解和422校验失败，无静默mock回退。
2. `前端文件/vite.config.ts`：独立5174，严格端口，`/api`同源代理到8001，可由`SUNCRAFT_API_TARGET`覆盖；Vite缓存改为当前前端`.cache/vite`，不继续复用旧5173的缓存。
3. `前端文件/src/App.tsx`、`src/export.ts`：仅更新数据来源/几何预览边界文案，不改布局、模型、相机或计算。API返回指标/虚线为后端模型值，前端几何口径尚未统一，非施工图/认证。
4. 根`README.md`、前端`README.md`更新当前入口与历史离线入口区别；前端`.gitignore`忽略独立缓存。
5. 新`start-linked-dev.sh`（不安装、不构建，端口占用即退出，不杀别人的进程）和本`integration-notes`目录。

不修改现有`start-demo.cmd`、`backend/`、物理/评分公式、美术、全景/去外景设置、已交付旧包。上传的预构建离线HTML未重建。

## 入口 / 已运行服务

- **浏览验收：http://127.0.0.1:5174/**（当前上传源码，默认API，无需手动设置）。
- 后端API：http://127.0.0.1:8001/api/presets；引擎原生文档`/engine/docs`。
- 8001首页仍是上传旧预构建HTML，默认mock，**不是本步验收入口**；旧5173也不是新副本。
- 实际监听进程：Vite5174 PID404705；Uvicorn8001 PID404701；旧5173 PID200651保留。
- Python本项目独立环境`../runtime-env`，按上传requirements安装FastAPI等必需依赖；NumPy复用已有系统可见库，未升级全局。Node依赖仅软链接现有`/workspace/suncraft-implementation/node_modules`，两个package.json的dependencies/devDependencies声明已比对一致，未拷贝旧源码。
- 实际Python3.13.5 / FastAPI0.165.0 / Pydantic2.14.4 / Uvicorn0.54.0 / NumPy2.5.5；Node24.22.1 / npm11.21.1 / Vite7.3.8。
- 启动命令与依赖重建方法见根README；本次两服务分别启动命令已真实执行，合并脚本做`bash -n`静态语法检查，未停止当前服务再重跑脚本。

## 契约与数据链（复用上传包现有适配）

实际服务使用`uvicorn --app-dir backend suncraft.demo:app`，**不是**`suncraft.api:app`。demo已转换前端city_id/latitude、louver_angle_deg、window_wall_ratio到原生引擎字段，返回Studio所需形状，本步无后端改造。

| API字段 | 当前消费者 / 处理 |
|---|---|
| presets.cities / daylight_threshold_pct | 城市和后端DF阈值；presets成功才放行simulate |
| metrics | 现有指标、诊断、设计单；is_gb_compliant只代表原后端模型判断，非验证认证 |
| heatmap_grid | 前端校验2–256行列矩形非负数值，不把24写死；当前后端真实24×24，现有热力使用结果矩阵 |
| solar_angles | Scene/Section的同步太阳高度；广州夏至南北侧仍按真实纬度判断，不造全年太阳 |
| svg_rays.winter_hit_depth | SVG冬深结果虚线；Section与export同一当前result，角度不是按深度反推伪造 |
| score_report | demo已有citation/link/warning归一化；前端adapter已真实接受四维十项，provenance=backend，score_report_error为空；API不显示独立88.4示例 |
| optimize.parameters/before/after | 固定城市/纬度/窗墙比校验；动画后重新simulate复核；不承诺任何参数都S级 |

评分显示联调到UI数据模型；本步未给现有SVG设计单另增评分版式。旧返回无score_report时仍降级“等待后端”，不会套用88.4。现有误差目标/规范引用均不等于实际校准。

## 最小真实HTTP证据

探针`step0-probe.mjs`通过Vite SSR仅加载**本上传源码**api.ts/model.ts，再真实fetch5174代理；不是浏览器、自动化套件或构建。原始请求/响应逐份保存在`http-evidence/01-presets.json`至`06-simulate.json`，汇总`summary.json`。

| 请求 | 真实返回 |
|---|---|
| GET presets | 200，上海31.2/北京39.9/广州23.1/哈尔滨45.8，DF阈值2 |
| POST simulate 默认上海0.40m/0°/0.45 | 200；遮阳1.0，冬得热0.7256163791，DF达标面积0.9340277778，冬进深2.3479774391m；太阳82.24°/35.36°；24×24；后端分91.14974，4维10项 |
| POST simulate 仅挑檐0.45m | 200；冬得热0.7019626186，DF面积0.8923611111，冬进深2.2979774391m；后端分90.297271，证明不是不随参数变化的88.4 |
| POST optimize 默认约束 | 200；返回挑檐0m/百叶0°，同城市/窗墙比；before91.14974→after94.352678，前端优化adapter接受；这是当前后端搜索输出，不是全局真实最佳保证 |
| POST optimize 窗墙比0.25 | 409；最大DF面积0.5763888889<目标0.8，客户端显示57.6%/80.0%与调整建议，不伪装成功 |
| POST simulate 城市纬度不匹配 | 422；客户端显示后端校验原因 |
| 已abort的signal | 前端api立即AbortError，不发送请求 |
| 不可达本地基址65534 | fetch失败抛出；不回退mock |
| OPTIONS 8001 | 200，允许Origin*和GET/POST，直接连接可用；正常5174入口同源代理无需跨域 |

主页/main/App/Section/export/api模块GET均200，仅证明Vite能转换并提供模块，不代表浏览器已渲染。首次探针因Node URL.pathname未解码中文目录失败，修为fileURLToPath后完成上述请求；该失败不是后端故障。

## 失败 / 取消 / 乱序静态审查

- `useSimulation.ts`原有80ms节流、AbortController、请求sequence和config source快照保留；旧请求、旧来源不可提交当前快照，旧指标待更新时标pending/stale。
- `App.tsx`优化operation序号、abort/tween.kill、取消/重置/参数改变处理保留；动画期间暂停模拟，结束后重算；接口模式不调用mock函数。
- `api.ts`原8秒超时/外部abort联动保留；真实409/422和网络不可达已最小验证。
- 预取消已验；**浏览器快速拖动乱序、飞行中取消、源切换/断网、真实SVG下载还待主任务实际操作**。客户端abort不保证后端同步CPU工作被中断，不能冒称服务端可撤销计算。

## 挑刺：目前最不满意三处（静态完成后）

1. **视觉/物理口径**：前端窗宽4.4m、居中开窗及百叶，与后端窗宽4.86m/固定0.45m窗台和百叶尺寸不同。已加API/设计单边界提示，但未“修成一致”：用户本步禁止改模型/公式，应先确认统一场景契约再改前端几何；不能把当前光带当精度验证。
2. **首次用户/启动一致性**：5174源码已经默认真API，但8001/原start-demo依旧旧离线HTML，容易开错入口。当前README置顶明确区分并给独立启动脚本；未重建离线版，因为明确禁止构建。后续获准构建时才能统一交付入口，不能拿旧离线文件冒充本轮。
3. **工程/验收边界**：端点和前端adapter通过，不等于React/Three浏览器全流程、快速乱序与取消已验证。保留成熟调度并交父任务真实浏览复查，不用跑满测试或虚构截图掩盖。没有实测FPS/性能或±10%精度，没有本机Windows回写验证。

## 请主任务浏览检查

1. 5174刷新即API；默认91.1左右的**后端模型分**而非88.4静态示例；打开四维十项看来源。确认全景/无外景不变。
2. 0.4→0.45m看进深2.35→2.30m、DF93%→89%和评分变化；开热力/冬季/剖面确认真实响应应用。
3. 优化默认约束，看后端返回0m、评分94.4左右并再次模拟；在0.25窗墙比寻优应显示无可行解409，不静默mock。
4. 快拖/取消/重置、临时切错API地址后恢复；旧结果不得冒充新结果。下载SVG确认数据源标识与当前参数，保持键盘和400窄屏。

截至此记录仅第0步，不开始美术/全年计算，不访问受限用户目录，不生成最终交付包。
