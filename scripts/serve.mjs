import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.zip': 'application/zip' };

http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    pathname = pathname.replace(/^\/casefolk(?=\/|$)/, '') || '/';
    if (pathname.endsWith('/')) pathname += 'index.html';
    const target = path.resolve(root, '.' + pathname);
    if (path.relative(root, target).startsWith('..')) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(data);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Страница не найдена');
  }
}).listen(port, '127.0.0.1', () => console.log(`Casefolk: http://127.0.0.1:${port}/casefolk/`));
