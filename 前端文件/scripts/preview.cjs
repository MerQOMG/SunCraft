// Local-only production preview. No package dependency or installation is required.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{let file;try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/')name='/index.html';file=path.resolve(root,'.'+name);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}}catch{res.writeHead(400);return res.end('Bad request')}
fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)})});
server.on('error',e=>{console.error(e.message);process.exitCode=1});server.listen(5173,'127.0.0.1',()=>console.log('SunCraft preview: http://127.0.0.1:5173 (Ctrl+C to stop)'));
