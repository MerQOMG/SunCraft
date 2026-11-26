# 静态 SSR 设计单（不是本轮页面下载）

这些 SVG 由当前源码 `designSheet` + `Section` 服务端渲染生成，并用 Python ElementTree 解析。它们不是浏览器「导出设计单」的真实下载，也不是 Chrome 预览或 02:53 旧样张。主线程须从 http://127.0.0.1:5174/ 在默认可导出状态下真实下载，另存到本目录以外或本目录下明确命名的 download/ 下，不要覆盖本文件，也不要把 /home/box/Downloads 里旧的 (10)/(11).svg 当成本轮证据。
