const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0]; // strip query string
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath.slice(1));
  const ext = path.extname(filePath);

  try {
    const data = fs.readFileSync(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'text/plain');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  } catch {
    // fallback to index.html for SPA routes
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }
}).listen(3001, () => console.log('Static server ready on port 3001'));
