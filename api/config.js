const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const TMP_PATH = '/tmp/config.json';

function readConfig() {
  // 1. /tmp/config.json (Telegram bot runtime guncellemeleri, instance-local)
  //    Bot yazinca ayni instance'dan okunursa guncel deger gelir
  try {
    if (fs.existsSync(TMP_PATH)) {
      const tmp = JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8'));
      if (tmp.phone || tmp.whatsapp || tmp.iban || tmp.name) {
        return tmp;
      }
    }
  } catch (_) {}

  // 2. data/config.json (git'teki son hali - her instance'ta ayni)
  try {
    const file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (file.phone || file.whatsapp || file.iban || file.name) {
      return file;
    }
  } catch (_) {}

  // 3. Env var fallback (hicbiri yoksa)
  return {
    iban: process.env.CONFIG_IBAN || '',
    name: process.env.CONFIG_NAME || '',
    phone: process.env.CONFIG_PHONE || '',
    whatsapp: process.env.CONFIG_WHATSAPP || '',
  };
}

function writeConfig(config) {
  const json = JSON.stringify(config, null, 2);

  // /tmp her zaman yazilabilir (Vercel serverless)
  try {
    const tmpDir = path.dirname(TMP_PATH);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(TMP_PATH, json, 'utf-8');
  } catch (_) {}

  // data/config.json yazilamazsa sorun degil (Vercel'de read-only)
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

  // GET: config degerlerini getir
  if (req.method === 'GET') {
    const cfg = readConfig();
    const key = (req.url.split('?')[1] || '').replace('key=', '');
    if (key === 'all') return res.status(200).json({ success: true, config: cfg });
    if (key && cfg[key] !== undefined) {
      return res.status(200).json({ success: true, key, value: cfg[key] });
    }
    return res.status(200).json({ success: true, config: cfg });
  }

  // POST: config guncelle (Telegram bot ve uyumlu araclarla kullanilir)
  if (req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);

    const expectedToken = process.env.TELEGRAM_CONFIG_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (body.token !== expectedToken) {
      return res.status(401).json({ success: false, error: 'Yetkisiz erisim.' });
    }

    const cfg = readConfig();
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

    writeConfig(cfg);

    return res.status(200).json({
      success: true,
      updated: changed,
      message: 'Guncellendi: ' + changed.join(', ')
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
