const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

const publicRoot = path.resolve(__dirname, '..', 'AutoDeck AI');
const port = Number(readOption('port', process.env.PORT || 8080));
const host = readOption('host', process.env.HOST || '127.0.0.1');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function resolveRequestPath(requestUrl) {
  const parsed = new URL(requestUrl, `http://${host}:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(publicRoot, `.${requested}`);

  if (!filePath.startsWith(`${publicRoot}${path.sep}`) && filePath !== publicRoot) {
    return null;
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const filePath = resolveRequestPath(req.url);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, 'Not Found');
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentType,
      'Content-Length': stats.size,
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Set PORT=another_port and run npm run dev again.`);
  } else if (error.code === 'EPERM') {
    console.error(`Permission denied while starting ${host}:${port}. Check local firewall or sandbox permissions.`);
  } else {
    console.error(error.message || error);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`AutoDeck AI local server running at http://${host}:${port}`);
  console.log(`Serving ${publicRoot}`);
});
