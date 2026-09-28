import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clinicEngine } from './clinic_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Consultation chat endpoint
      if (pathname === '/api/chat' && req.method === 'POST') {
        const body = await parseBody(req);
        const { sessionId = 'default-patient', message = '', code = '', error = '', expected = '', actual = '', userConfig = {} } = body;
        
        // Use clinicEngine
        const result = await clinicEngine.diagnoseLocally({
          sessionId,
          message,
          code,
          error,
          expected,
          actual,
          userConfig
        });

        sendJson(res, 200, result);
        return;
      }

      // 2. Feedback outcome endpoint ("Did this solve it?")
      if (pathname === '/api/feedback' && req.method === 'POST') {
        const body = await parseBody(req);
        const { sessionId, fixId, solved, feedbackText } = body;
        const result = await clinicEngine.recordOutcome(sessionId, { fixId, solved, feedbackText });
        sendJson(res, 200, result);
        return;
      }

      // 3. Code Sandbox runner endpoint
      if (pathname === '/api/sandbox/run' && req.method === 'POST') {
        const body = await parseBody(req);
        const { language, code } = body;
        const result = await clinicEngine.executeCodeSandbox(language, code);
        sendJson(res, 200, result);
        return;
      }

      // 4. Web search tool endpoint
      if (pathname === '/api/search' && req.method === 'POST') {
        const body = await parseBody(req);
        const { query } = body;
        const result = await clinicEngine.executeWebSearch(query);
        sendJson(res, 200, result);
        return;
      }

      // 5. Get Session / Patient Chart
      if (pathname.startsWith('/api/session/') && req.method === 'GET') {
        const sessionId = pathname.replace('/api/session/', '').trim() || 'default-patient';
        const session = await clinicEngine.getSession(sessionId);
        sendJson(res, 200, session);
        return;
      }

      // 6. Get Cases & Learning Vault
      if (pathname === '/api/cases' && req.method === 'GET') {
        const templates = clinicEngine.getTemplates();
        const learned = clinicEngine.getLearningStore();
        sendJson(res, 200, { templates, learned });
        return;
      }

      // Unknown API route
      sendJson(res, 404, { error: 'API route not found' });
      return;
    } catch (err) {
      console.error('API Error:', err);
      sendJson(res, 500, { error: err.message || 'Internal Server Error' });
      return;
    }
  }

  // Static File Serving
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  if (existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA if not found
    const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
    if (existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      createReadStream(fallbackPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  }
});

const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(`🩺 Code Clinic server running at http://${HOST}:${PORT}`);
});
