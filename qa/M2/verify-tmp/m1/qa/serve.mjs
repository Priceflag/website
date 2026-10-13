#!/usr/bin/env node
/* =============================================================================
   qa/serve.mjs — tiny zero-dependency static server that mimics how Vercel
   serves this repo, so local QA == deployed site as closely as possible.

     node qa/serve.mjs [port] [root]   # default 8902 (or $PORT), repo root
     QA_SERVE_REDIRECTS=1 node qa/serve.mjs   # also apply vercel.json redirects

   Behaviour:
   - Serves files from the repo root.
   - Applies vercel.json `rewrites` (exact-path sources only; that is all this
     repo uses) and vercel.json `headers` (exact-path sources).
   - Clean URLs: `/x` -> `/x.html` if it exists; `/dir/` -> `/dir/index.html`.
   - Honors .vercelignore: ignored paths return 404 (as on Vercel, where they
     are never uploaded). Dotfiles/.git are always 404.
   - Unknown paths -> 404 status (serves /404.html as the body if present).
   - Text responses are brotli/gzip-compressed like Vercel's edge (matters for Lighthouse).
   - `redirects` are NOT applied by default, so pages that production redirects
     away (e.g. /signin.html -> dashboard host) can still be tested locally.
     Set QA_SERVE_REDIRECTS=1 to apply them (host-conditional ones are skipped).
   ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json',
};

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

/** Compile .vercelignore (gitignore-style subset) into a predicate on repo-relative paths. */
export function loadIgnore(root = ROOT) {
  let lines = [];
  try { lines = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8').split(/\r?\n/); } catch {}
  const rules = [];
  for (let raw of lines) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let negate = false;
    if (line.startsWith('!')) { negate = true; line = line.slice(1); }
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.startsWith('/') || line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    const re = line
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\/?/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\u0000/g, '(?:.*/)?');
    // A match on the path itself or any ancestor directory ignores the path.
    const body = anchored ? `^${re}` : `(?:^|/)${re}`;
    rules.push({ negate, regex: new RegExp(body + (dirOnly ? '(?:/.*)$' : '(?:/.*)?$')) });
  }
  return (rel) => {
    rel = rel.replace(/^\/+/, '');
    if (rel.split('/').some((seg) => seg.startsWith('.'))) return true; // dotfiles never served
    if (/^node_modules(\/|$)/.test(rel)) return true;
    let ignored = false;
    for (const r of rules) if (r.regex.test(rel)) ignored = !r.negate;
    return ignored;
  };
}

function exactMap(list = []) {
  const m = new Map();
  for (const r of list) if (r && typeof r.source === 'string' && !/[:*(]/.test(r.source)) m.set(r.source, r);
  return m;
}

export function createHandler({ root = ROOT, applyRedirects = process.env.QA_SERVE_REDIRECTS === '1' } = {}) {
  root = path.resolve(root);
  const vercel = readJson(path.join(root, 'vercel.json'), {});
  const rewrites = exactMap(vercel.rewrites);
  const redirects = (vercel.redirects || []).filter((r) => !r.has && !r.missing);
  const redirectMap = exactMap(redirects);
  const headers = exactMap(vercel.headers);
  const isIgnored = loadIgnore(root);

  const fileFor = (urlPath) => {
    const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
    if (rel.includes('\0')) return null;
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) return null;
    if (isIgnored(path.relative(root, abs).split(path.sep).join('/'))) return null;
    try {
      const st = fs.statSync(abs);
      if (st.isFile()) return abs;
      if (st.isDirectory()) {
        const idx = path.join(abs, 'index.html');
        if (fs.existsSync(idx) && !isIgnored(path.relative(root, idx).split(path.sep).join('/'))) return idx;
      }
    } catch {}
    return null;
  };

  return (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
    let p = url.pathname;

    if (applyRedirects && redirectMap.has(p)) {
      const r = redirectMap.get(p);
      res.writeHead(r.permanent === false ? 307 : 308, { Location: r.destination });
      return res.end();
    }

    const extraHeaders = {};
    if (headers.has(p)) for (const h of headers.get(p).headers || []) extraHeaders[h.key] = h.value;

    let target = rewrites.has(p) ? rewrites.get(p).destination : p;
    let file = fileFor(target);
    if (!file && !path.extname(target) && !target.endsWith('/')) file = fileFor(target + '.html');

    let status = 200;
    if (!file) {
      status = 404;
      file = fileFor('/404.html');
    }
    const send = (code, body, type) => {
      const h = { 'Content-Type': type, 'Cache-Control': 'public, max-age=0, must-revalidate', Vary: 'Accept-Encoding', ...extraHeaders };
      // Vercel's edge compresses text responses; do the same so Lighthouse transfer sizes match.
      const ae = String(req.headers['accept-encoding'] || '');
      if (typeof body !== 'string' && /^(text\/|application\/(json|javascript|xml|manifest)|image\/svg)/.test(type) && body.length > 1024) {
        if (/\bbr\b/.test(ae)) { body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }); h['Content-Encoding'] = 'br'; }
        else if (/\bgzip\b/.test(ae)) { body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip'; }
      }
      h['Content-Length'] = Buffer.byteLength(body);
      res.writeHead(code, h);
      if (req.method === 'HEAD') return res.end();
      res.end(body);
    };
    if (!file) return send(404, 'Not Found', 'text/plain; charset=utf-8');
    fs.readFile(file, (err, buf) => {
      if (err) return send(500, 'Internal error', 'text/plain; charset=utf-8');
      send(status, buf, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    });
  };
}

/** Start the server; resolves to { server, port, url, close() }. port 0 = random free port. */
export function startServer({ port = 0, host = '127.0.0.1', ...opts } = {}) {
  const server = http.createServer(createHandler(opts));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://${host}:${actual}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.argv[2] || process.env.PORT || 8902);
  const root = path.resolve(process.argv[3] || ROOT);
  startServer({ port, root }).then(({ url }) => console.log(`QA static server (Vercel-like) at ${url}  root=${root}`));
}
