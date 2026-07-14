const fs = require('fs');
const path = require('path');
const { get, put } = require('@vercel/blob');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const TMP_PATH = '/tmp/config.json';
const BLOB_PATH = 'config.json';

function getDefaults() {
  return {
    iban: process.env.CONFIG_IBAN || '',
    name: process.env.CONFIG_NAME || '',
    phone: process.env.CONFIG_PHONE || '',
    whatsapp: process.env.CONFIG_WHATSAPP || '',
  };
}

async function readConfig() {
  const cfg = getDefaults();

  // 1. Blob store (kalici, tum instance'lar ortak)
  try {
    const blob = await get(BLOB_PATH);
    if (blob) {
      const text = await blob.text();
      const data = JSON.parse(text);
      for (const k of ['iban', 'name', 'phone', 'whatsapp']) {
        if (data[k]) cfg[k] = data[k];
      }
    }
  } catch (_) {}

  // 2. /tmp/config.json (cache - ayni instance icin hizli)
  try {
    if (fs.existsSync(TMP_PATH)) {
      const tmp = JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8'));
      for (const k of ['iban', 'name', 'phone', 'whatsapp']) {
        if (tmp[k]) cfg[k] = tmp[k];
      }
    }
  } catch (_) {}

  // 3. data/config.json (git fallback)
  try {
    const file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    for (const k of ['iban', 'name', 'phone', 'whatsapp']) {
      if (!cfg[k] && file[k]) cfg[k] = file[k];
    }
  } catch (_) {}

  return cfg;
}

async function writeConfig(config) {
  const json = JSON.stringify(config, null, 2);

  // 1. Blob store (kalici)
  try {
    await put(BLOB_PATH, json, { access: 'private', addRandomSuffix: false });
  } catch (e) {
    console.error('Blob write failed:', e.message);
  }

  // 2. /tmp (hizli cache)
  try {
    const tmpDir = path.dirname(TMP_PATH);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(TMP_PATH, json, 'utf-8');
  } catch (_) {}

  // 3. data/config.json (Vercel'de read-only)
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, json, 'utf-8');
  } catch (_) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const cfg = await readConfig();
    const key = (req.url.split('?')[1] || '').replace('key=', '');
    if (key === 'all') return res.status(200).json({ success: true, config: cfg });
    if (key && cfg[key] !== undefined) {
      return res.status(200).json({ success: true, key, value: cfg[key] });
    }
    return res.status(200).json({ success: true, config: cfg });
  }

  if (req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);

    const expectedToken = process.env.TELEGRAM_CONFIG_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (body.token !== expectedToken) {
      return res.status(401).json({ success: false, error: 'Yetkisiz erisim.' });
    }

    const cfg = await readConfig();
    const allowedKeys = ['iban', 'name', 'phone', 'whatsapp'];
    let changed = [];

    for (const k of allowedKeys) {
      if (body[k] !== undefined && typeof body[k] === 'string') {
        cfg[k] = body[k].trim();
        changed.push(k);
      }
    }

    if (changed.length === 0) {
      return res.status(400).json({ success: false, error: 'Guncellenecek deger bulunamadi.' });
    }

    await writeConfig(cfg);

    return res.status(200).json({
      success: true,
      updated: changed,
      message: 'Guncellendi: ' + changed.join(', ')
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
