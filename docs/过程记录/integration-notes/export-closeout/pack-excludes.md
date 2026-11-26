# 08:00 可恢复源码包 · 建议排除与纳入

供主线程在**真实页面下载与对照截图齐备之后**运行 `pack-runtime-source.py`。本轮不打最终包，也不把 03:04 的 `SunCraft-runtime-source-20261126.zip` 复制改名。

## 纳入

- `前端文件/`（含 `package-lock.json`、源码与测试；不含其下被排除的目录）
- `backend/`（含 requirements / 测试，不含 `__pycache__`）
- `integration-notes/`（全部阶段记录，含本目录；不要丢掉主线程后来放入的 REVIEW 与实看图）
- 根目录：`README.md`、`.gitignore`、`start-linked-dev.sh` 及同级启动说明 / lock / requirements（若有）

## 排除

- `node_modules/`
- `dist` / `build` / `out` / `coverage` / `target`
- `.cache` / `.vite` / `.turbo` / 其它点目录工具缓存（`.gitignore` 本身要保留）
- `__pycache__` / `.pytest_cache` / `.git`
- `*.pyc`
- 可选：本机 Downloads 里的旧 `(10).svg` / `(11).svg` 不得打进包冒充本轮下载。本目录 `static-ssr/` 是源码生成的 XML，可以进包，但必须与真实下载分开存放（建议主线程把真实下载放到 `integration-notes/export-closeout/downloads/` 后再打包）。

## 输出

默认写到父目录：

- `SunCraft-runtime-source-20261126-closeout.zip`
- `SunCraft-runtime-source-20261126-closeout.zip.sha256.txt`

脚本拒绝覆盖或使用 `SunCraft-runtime-source-20261126.zip` 这一旧文件名。
