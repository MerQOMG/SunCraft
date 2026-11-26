# 相对 03:04 源码包的工作树差异说明草稿

比较对象：

- 03:04 包：`/workspace/suncraft-upload-20261125-2314/SunCraft-runtime-source-20261126.zip`（旁路 SHA-256 `143e36613c53660958970387f29c62bb49fb0050bac5cf47c1d463163acd6776`，406 个文件）。
- 当前工作树：`/workspace/suncraft-upload-20261125-2314/extracted`，排除 `node_modules` / `dist` / `build` / `out` / `coverage` / `target` / `.cache` / `__pycache__` / `.git`。当前可比文件 508 个。

**这不是 08:00 验收包，也不得把 03:04 包复制改名当成已含此后改动的包。** 本轮没有页面真实下载证据，不得宣布任何 zip 已验收。`前端文件/src/export.ts` 与 `Section.tsx`、`lighting.ts` 的内容与 03:04 包一致；导出规则是按当前源码重验，不是靠旧包或 02:53 样张。

统计：新增 102，删除 0，内容变化 11。

## 内容已变化（相对 03:04 包）

产品源码：

- `前端文件/src/materials.ts`、`surfaceSamples.ts`、`modeling/construction.ts`、`modeling/interior.ts`、`modeling/upholstery.ts` — 03:20 材质缺口轮（地板/墙面/织物/地毯/柜脚），视觉验收仍归主线程。
- `前端文件/src/scoring/ScoreDrawer.tsx`、`AnnualTimeline.tsx`、`App.tsx` — 05 点交互轮（等待文案「上次分仅供对照」、播放中手动改日期 pointerdown 先暂停、重置 aria）。
- `前端文件/src/Scene.tsx`、`annual.css` — 06 点适配轮（WebGL 构造后守卫与更早的 contextlost 监听；展开「月份/节气」时预留行高，避免盖住画布）。`App.tsx` 在 05/06 均有触及。

记录：

- `integration-notes/freeze/HANDOFF.md` — 打包后补写（例如禁用导出描边复验），本轮未改此文件。

`export.ts`、`Section.tsx`、`lighting.ts`、`styles.css`、后端公式文件均与 03:04 包一致。

## 新增（不在 03:04 包内）

- `前端文件/tests/interaction-play-capsule.test.tsx` — 05 点等待/失败胶囊 SSR 定向检查。
- `integration-notes/materials-gap/` — 材质缺口记录与改前静帧。
- `integration-notes/interaction-play/` — 播放一致性规则与静态证据。
- `integration-notes/responsive-perf-r2/` — 适配/WebGL/开销记录。
- `integration-notes/export-closeout/` — 本轮记录、静态 SSR 设计单（**不是**页面下载）与打包脚本。

## 仅存在于 03:04 包、当前树没有

无。

## 打包时请注意

主线程在真实下载与截图齐备、页面已回到默认状态后，再运行 `integration-notes/export-closeout/pack-runtime-source.py`。输出到父目录，文件名建议 `SunCraft-runtime-source-20261126-closeout.zip`（脚本默认即此名），**不得**复用 `SunCraft-runtime-source-20261126.zip`。排除规则见脚本与 `pack-excludes.md`。
