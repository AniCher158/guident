import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import OpenAI from 'openai';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const port = Number(process.env.GUIDENT_API_PORT || 8787);
const model = process.env.OPENAI_MODEL || process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4.1-mini';
const apiKey = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!apiKey) {
  console.error('Missing OPENAI_API_KEY (or legacy EXPO_PUBLIC_OPENAI_API_KEY) in .env');
  process.exit(1);
}

const client = new OpenAI({ apiKey });

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    writeJson(res, 400, { error: { message: 'Missing URL.' } });
    return;
  }

  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    writeJson(res, 200, { ok: true, model });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/reply') {
    try {
      const body = await readJsonBody(req);
      const input = typeof body.input === 'string' ? body.input : '';
      const temperature = typeof body.temperature === 'number' ? body.temperature : 0.35;
      if (!input) {
        writeJson(res, 400, { error: { message: 'Missing input.' } });
        return;
      }

      const response = await client.responses.create({
        model,
        input,
        temperature,
      });

      writeJson(res, 200, {
        output_text: response.output_text ?? '',
        model,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown backend error.';
      writeJson(res, 500, { error: { message } });
      return;
    }
  }

  writeJson(res, 404, { error: { message: 'Not found.' } });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Guident LLM proxy listening on http://0.0.0.0:${port}`);
});
