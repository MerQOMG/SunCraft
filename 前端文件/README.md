# 前端工程

运行入口、环境要求和完整命令见 [根目录 README](../README.md)。

- `src/components/`：场景、剖面、日期控件。
- `src/hooks/`：模拟请求、取消、结果时效与状态管理。
- `src/styles/`：页面及日期控件样式；评分样式与评分组件放在 `src/scoring/`。
- `src/modeling/`：三维家具和窗构件。
- `src/localEngine.ts`：浏览器中的当前方案计算。
- `src/scoring/`：同后端规则的总分、报告与界面。
- `tests/fixtures/`：后端基准、旧接口模拟数据和固定界面示例；正式代码不从测试目录导入。
- `scripts/build-offline.mjs`：生成唯一的根目录 `夏遮冬透.html`。
- `scripts/preview.cjs`：在 5175 提供同一份离线工作台。

`npm test`、`npm run build`、`npm run build:offline` 与 `npm run format:check` 用于日常检查。浏览器测试产生的截图和下载文件位于忽略提交的 `test-results/evidence/`，不再写进源码或公开静态目录。

热力图默认使用“日期光照”，按当天太阳方向、窗口与遮阳几何计算理想地面的直射与漫射相对强度；可切换“全阴天DF”查看原始固定采光系数。相对光照不代表实测 lux 或天气数据。
