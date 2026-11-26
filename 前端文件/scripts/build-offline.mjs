import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import fs from 'node:fs/promises';
// Keep the portable demo independent of a developer's live-API .env settings.
const result = await build({
  configFile: false,
  plugins: [react(), tailwind()],
  base: './',
  define: {
    'import.meta.env.VITE_DATA_MODE': JSON.stringify('mock'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:8001'),
  },
  build: { write: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
const script = outputs
  .filter((o) => o.type === 'chunk')
  .map((o) => o.code)
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');
const css = outputs
  .filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'))
  .map((o) => o.source)
  .join('\n');
const favicon = encodeURIComponent(
  await fs.readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8'),
);
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${favicon}"><title>夏遮冬透 · SunCraft 离线工作台</title><style>${css}</style></head><body><div id="root"></div><script type="module">${script}</script></body></html>`;
await fs.writeFile(new URL('../../夏遮冬透.html', import.meta.url), html);
console.log('Updated the root SunCraft offline workbench.');
