import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,'.','SUNCRAFT_');
 return {plugins:[react(),tailwind()],base:'./',cacheDir:'.cache/vite',server:{host:'127.0.0.1',port:5174,strictPort:true,
  proxy:{'/api':{target:env.SUNCRAFT_API_TARGET||'http://127.0.0.1:8001',changeOrigin:false}}},
  build:{rollupOptions:{output:{manualChunks:{three:['three'],gsap:['gsap']}}}}};
});
