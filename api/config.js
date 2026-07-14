const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const TMP_PATH = '/tmp/config.json';

function readConfig() {
  // 1. Env var'lardan oku (kalıcı)
  const cfg = {
    iban: process.env.CONFIG_IBAN || '',
    name: process.env.CONFIG_NAME || '',
    phone: process.env.CONFIG_PHONE || '',
    whatsapp: process.env.CONFIG_WHATSAPP || '',
  };

  // 2. /tmp/config.json (Telegram runtime güncellemeleri)
  try {
    if (fs.existsSync(TMP_PATH)) {
      const tmp = JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8'));
      for (const k of ['iban', 'name', 'phone', 'whatsapp']) {
        if (tmp[k]) cfg[k] = tmp[k];
      }
    }
  } catch (_) {}

  // 3. data/config.json (git'teki son hali)
  try {
    const file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    for (const k of ['iban', 'name', 'phone', 'whatsapp']) {
      if (!cfg[k] && file[k]) cfg[k] = file[k];
    }
  } catch (_) {}

  return cfg;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: return config values (optionally filter by key)
  if (req.method === 'GET') {
    const cfg = readConfig();
    const key = (req.url.split('?')[1] || '').replace('key=', '');
    if (key === 'all') return res.status(200).json({ success: true, config: cfg });
    if (key && cfg[key] !== undefined) {
      return res.status(200).json({ success: true, key, value: cfg[key] });
    }
    return res.status(200).json({ success: true, config: cfg });
  }

  // POST: update config (authenticated via secret token)
  if (req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);

    // Simple auth: require TELEGRAM_CONFIG_TOKEN in request
    const expectedToken = process.env.TELEGRAM_CONFIG_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (body.token !== expectedToken) {
      return res.status(401).json({ success: false, error: 'Yetkisiz erişim.' });
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
      return res.status(400).json({ success: false, error: 'Güncellenecek değer bulunamadı.' });
    }

    // Write to /tmp for runtime persistence
    try { fs.writeFileSync(TMP_PATH, JSON.stringify(cfg, null, 2), 'utf-8'); } catch (_) {}
    // Also try to write the committed file
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8'); } catch (_) {}

    return res.status(200).json({
      success: true,
      updated: changed,
      message: `Güncellendi: ${changed.join(', ')}`
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
