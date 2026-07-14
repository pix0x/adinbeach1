const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const TMP_PATH = '/tmp/config.json';

// Vercel Blob REST API (tum instance'lar arasi kalici depolama)
const BLOB_STORE_ID = process.env.BLOB_STORE_ID;
const BLOB_API = process.env.VERCEL_BLOB_API_URL || 'https://vercel.com/api/blob';

function getOidcToken(req) {
  var h = req ? req.headers['x-vercel-oidc-token'] : undefined;
  return h || process.env.VERCEL_OIDC_TOKEN;
}

async function blobGet(req) {
  if (!BLOB_STORE_ID) return null;
  var token = getOidcToken(req);
  if (!token) return null;
  try {
    var res = await fetch(BLOB_API + '/?pathname=config.json', {
      headers: {
        authorization: 'Bearer ' + token,
        'x-vercel-blob-store-id': BLOB_STORE_ID,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

async function blobPut(data, req) {
  if (!BLOB_STORE_ID) return;
  var token = getOidcToken(req);
  if (!token) return;
  try {
    var json = JSON.stringify(data);
    await fetch(BLOB_API + '/?pathname=config.json', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer ' + token,
        'x-vercel-blob-store-id': BLOB_STORE_ID,
        'x-api-blob-request-id': require('crypto').randomUUID(),
        'x-api-blob-request-attempt': '0',
        'x-api-version': '12',
        'x-vercel-blob-access': 'public',
        'x-content-type': 'application/json',
        'x-content-length': String(Buffer.byteLength(json)),
        'x-add-random-suffix': '0',
      },
      body: json,
    });
  } catch (_) {}
}

function getDefaults() {
  return {
    iban: process.env.CONFIG_IBAN || '',
    name: process.env.CONFIG_NAME || '',
    phone: process.env.CONFIG_PHONE || '',
    whatsapp: process.env.CONFIG_WHATSAPP || '',
  };
}

async function readConfig(req) {
  var cfg = getDefaults();

  // 1. Blob store (kalici)
  var bd = await blobGet(req);
  if (bd) {
    for (var k of ['iban', 'name', 'phone', 'whatsapp']) { if (bd[k]) cfg[k] = bd[k]; }
  }

  // 2. /tmp (cache)
  try {
    if (fs.existsSync(TMP_PATH)) {
      var tmp = JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8'));
      for (var k of ['iban', 'name', 'phone', 'whatsapp']) { if (tmp[k]) cfg[k] = tmp[k]; }
    }
  } catch (_) {}

  // 3. data/config.json (git fallback)
  try {
    var f = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    for (var k of ['iban', 'name', 'phone', 'whatsapp']) { if (!cfg[k] && f[k]) cfg[k] = f[k]; }
  } catch (_) {}

  return cfg;
}

async function writeConfig(config, req) {
  // 1. Blob (kalici)
  await blobPut(config, req);

  // 2. /tmp (cache)
  try {
    var json = JSON.stringify(config, null, 2);
    var d = path.dirname(TMP_PATH);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(TMP_PATH, json, 'utf-8');
  } catch (_) {}

  // 3. data/config.json
  try {
    var json = JSON.stringify(config, null, 2);
    var d = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, json, 'utf-8');
  } catch (_) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    var cfg = await readConfig(req);
    var key = (req.url.split('?')[1] || '').replace('key=', '');
    if (key === 'all') return res.status(200).json({ success: true, config: cfg });
    if (key && cfg[key] !== undefined) return res.status(200).json({ success: true, key: key, value: cfg[key] });
    return res.status(200).json({ success: true, config: cfg });
  }

  if (req.method === 'POST') {
    var raw = '';
    for await (var chunk of req) raw += chunk;
    var body = JSON.parse(raw);

    var expectedToken = process.env.TELEGRAM_CONFIG_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (body.token !== expectedToken) return res.status(401).json({ success: false, error: 'Yetkisiz erisim.' });

    var cfg = await readConfig(req);
    var allowedKeys = ['iban', 'name', 'phone', 'whatsapp'];
    var changed = [];

    for (var k of allowedKeys) {
      if (body[k] !== undefined && typeof body[k] === 'string') {
        cfg[k] = body[k].trim();
        changed.push(k);
      }
    }

    if (changed.length === 0) return res.status(400).json({ success: false, error: 'Guncellenecek deger bulunamadi.' });

    await writeConfig(cfg, req);

    return res.status(200).json({ success: true, updated: changed, message: 'Guncellendi: ' + changed.join(', ') });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
