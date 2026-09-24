import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The starting plan embedded in index.html. */
export function seedState() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return JSON.parse(html.match(/<script type="application\/json" id="seed">([\s\S]*?)<\/script>/)[1]);
}

/** Static server for the repo + POST /api handled by the given backend. apiUrl gets injected into assets/config.js. */
export function serve(backend, { withApi = true } = {}) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api') {
      if (req.method === 'GET') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(backend.get(Object.fromEntries(url.searchParams)))); }
      let body = ''; req.on('data', c => body += c); req.on('end', () => {
        res.setHeader('content-type', 'application/json'); res.setHeader('access-control-allow-origin', '*');
        try { res.end(JSON.stringify(backend.post(JSON.parse(body)))); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(e) })); }
      });
      return;
    }
    let p = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
    let data = fs.readFileSync(p);
    if (withApi && url.pathname === '/assets/config.js') {
      data = Buffer.from(String(data).replace('API_URL: ""', `API_URL: "http://127.0.0.1:${server.address().port}/api"`).replace('POLL_SECONDS: 30', 'POLL_SECONDS: 2'));
    }
    res.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}
