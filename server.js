const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'gmp-data.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { records: [], weeks: {}, notedWeeks: {}, sp: [], updatedAt: Date.now() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { records: [], weeks: {}, notedWeeks: {}, sp: [], updatedAt: Date.now() };
  }
}

function writeData(data) {
  ensureDataFile();
  data.updatedAt = Date.now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function mergeData(existing, incoming) {
  const recordMap = new Map();

  // Existing records
  for (const r of existing.records || []) {
    if (r && r.id) recordMap.set(r.id, r);
  }

  // Incoming records
  for (const r of incoming.records || []) {
    if (!r || !r.id) continue;
    if (!recordMap.has(r.id)) {
      recordMap.set(r.id, r);
    } else {
      const cur = recordMap.get(r.id);
      const merged = { ...cur, ...r };

      // Keep existing decision if incoming is still pending
      if (cur.status && cur.status !== 'Pending Verification' && r.status === 'Pending Verification') {
        merged.status = cur.status;
        merged.verifiedBy = cur.verifiedBy;
        merged.verifierSig = cur.verifierSig;
        merged.decidedAt = cur.decidedAt;
        merged.violation = cur.violation;
        merged.remarks = cur.remarks;
      }

      // Keep existing timeout if incoming lacks it
      if (cur.timeOut && !r.timeOut) {
        merged.timeOut = cur.timeOut;
        merged.timeOutItems = cur.timeOutItems;
      }

      // Keep longest break history
      if ((cur.breaks || []).length > (r.breaks || []).length) {
        merged.breaks = cur.breaks;
      }

      recordMap.set(r.id, merged);
    }
  }

  // Sort descending by timestamp
  const mergedRecords = Array.from(recordMap.values()).sort((a, b) => {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });

  const mergedWeeks = { ...(existing.weeks || {}), ...(incoming.weeks || {}) };
  const mergedNoted = { ...(existing.notedWeeks || {}), ...(incoming.notedWeeks || {}) };

  // Merge saved personnel
  const spMap = new Map();
  for (const p of [...(existing.sp || []), ...(incoming.sp || [])]) {
    if (p && p.name) spMap.set(p.name.trim().toLowerCase(), p);
  }
  const mergedSp = Array.from(spMap.values());

  return {
    records: mergedRecords,
    weeks: mergedWeeks,
    notedWeeks: mergedNoted,
    sp: mergedSp,
    updatedAt: Date.now()
  };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  let reqPath = decodeURI(req.url.split('?')[0]);

  // REST API Endpoints
  if (reqPath === '/api/data' && req.method === 'GET') {
    const data = readData();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(data));
  }

  if (reqPath === '/api/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const incoming = JSON.parse(body || '{}');
        const existing = readData();
        const merged = mergeData(existing, incoming);
        writeData(merged);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(merged));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (reqPath === '/api/clear' && req.method === 'POST') {
    const emptyData = { records: [], weeks: {}, notedWeeks: {}, sp: [], updatedAt: Date.now() };
    writeData(emptyData);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: true }));
  }

  // Static files
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('500 Internal Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`GMP Loose Item Monitoring server running on http://0.0.0.0:${PORT}`);
});
