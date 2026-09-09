/**
 * Onyx AI — Static file server (zero dependencies)
 *
 * Melayani folder `public/` dengan:
 *  - MIME type yang benar
 *  - Kompresi gzip/brotli untuk aset teks
 *  - Proteksi path traversal
 *  - SPA fallback ke index.html
 *
 * Jalankan:  node server.js   (atau `npm start`)
 * Port default: 3000 (ubah lewat env PORT)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt', '.md', '.map']);

function log(req, code, ms, bytes) {
  const size = bytes != null ? `${(bytes / 1024).toFixed(1)}kB` : '-';
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} → ${code} ${ms}ms ${size}`);
}

function sendError(res, req, code, message) {
  const body = JSON.stringify({ error: message });
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
  log(req, code, 0, body.length);
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendError(res, req, 405, 'Method not allowed');
  }

  // Health check sederhana
  if (req.url.split('?')[0] === '/api/health') {
    const body = JSON.stringify({ ok: true, app: 'Onyx AI', time: new Date().toISOString() });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : body);
    return log(req, 200, Date.now() - started, body.length);
  }

  // Normalisasi & amankan path
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return sendError(res, req, 400, 'Bad request');
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return sendError(res, req, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // File dengan ekstensi (mis. .js) yang hilang → 404 sungguhan.
      // Path tanpa ekstensi → SPA fallback ke index.html.
      if (path.extname(urlPath)) {
        return sendError(res, req, 404, 'Not found');
      }
      filePath = path.join(ROOT, 'index.html');
      try {
        if (!fs.statSync(filePath).isFile()) throw new Error();
      } catch {
        return sendError(res, req, 404, 'Not found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const size = fs.statSync(filePath).size;

    const headers = {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };

    // Aset vendor & icon boleh di-cache lama; sisanya revalidate
    if (urlPath.startsWith('/js/vendor/') || urlPath.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=86400';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

    // Kompresi untuk file teks yang cukup besar
    const accept = req.headers['accept-encoding'] || '';
    let stream = fs.createReadStream(filePath);
    let compressed = false;
    if (COMPRESSIBLE.has(ext) && size > 1024) {
      if (accept.includes('br')) {
        headers['Content-Encoding'] = 'br';
        headers['Content-Length'] = 0; // dihapus, chunked
        delete headers['Content-Length'];
        stream = stream.pipe(zlib.createBrotli());
        compressed = true;
        headers['Vary'] = 'Accept-Encoding';
      } else if (accept.includes('gzip')) {
        stream = stream.pipe(zlib.createGzip());
        compressed = true;
        headers['Vary'] = 'Accept-Encoding';
      }
    }
    if (!compressed) headers['Content-Length'] = size;

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      stream.destroy();
      res.end();
      return log(req, 200, Date.now() - started, 0);
    }
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    res.on('finish', () => log(req, 200, Date.now() - started, compressed ? null : size));
  });
});

// Jalankan server di 0.0.0.0 (wajib untuk lingkungan preview/container)
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │            ◆  O N Y X   A I             │');
  console.log('  ├─────────────────────────────────────────┤');
  console.log(`  │  Server berjalan di                     │`);
  console.log(`  │  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${' '.repeat(Math.max(0, 22 - HOST.length))}│`);
  console.log('  │                                         │');
  console.log('  │  Tekan Ctrl+C untuk berhenti            │');
  console.log('  └─────────────────────────────────────────┘');
  console.log('');
});
