// Preview the self-contained demo over HTTP; no build or node_modules required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const entry = path.resolve(__dirname, '../../夏遮冬透.html');
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  if (req.url !== '/' && req.url !== '/index.html') {
    res.writeHead(404);
    return res.end('Not found');
  }
  fs.readFile(entry, (error, data) => {
    if (error) {
      res.writeHead(500);
      return res.end('SunCraft demo HTML is missing. Run npm run build:offline.');
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(5175, '127.0.0.1', () =>
  console.log('SunCraft demo: http://127.0.0.1:5175/ (Ctrl+C to stop)'),
);
