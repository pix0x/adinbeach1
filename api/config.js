const fs = require('fs');
const path = require('path');
const { put, get } = require('@vercel/blob');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const TMP_PATH = '/tmp/config.json';

function getDefaults() {
  return {
    iban: process.env.CONFIG_IBAN || '',
    name: process.env.CONFIG_NAME || '',
    phone: process.env.CONFIG_PHONE || '',
    whatsapp: process.env.CONFIG_WHATSAPP || '',
  };
}

async function readConfig() {
  var cfg = getDefaults();
  var bd = await blobGet();
  if (bd) {
    for (var k of ['iban', 'name', 'phone', 'whatsapp']) { if (bd[k]) cfg[k] = bd[k]; }
  }
  try {
    if (fs.existsSync(TMP_PATH)) {
      var tmp = JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8'));
      for (var k of ['iban', 'name', 'phone', 'whatsapp']) { if (tmp[k]) cfg[k] = tmp[k]; }
    }
  } catch (_) {}
  try {
    var f = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    for (var k of ['iban', 'name', 'phone', 'whatsapp']) { if (!cfg[k] && f[k]) cfg[k] = f[k]; }
  } catch (_) {}
  return cfg;
}

async function writeConfig(config) {
  await blobPut(config);
  try {
    var json = JSON.stringify(config, null, 2);
    var d = path.dirname(TMP_PATH);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(TMP_PATH, json, 'utf-8');
  } catch (_) {}
  try {
    var json = JSON.stringify(config, null, 2);
    var d = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, json, 'utf-8');
  } catch (_) {}
}

async function blobGet() {
  try {
    var blob = await get('config.json', { access: 'public' });
    if (!blob || !blob.stream) return null;
    var reader = blob.stream.getReader();
    var decoder = new TextDecoder();
    var chunks = [];
    while (true) {
      var { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(''));
  } catch (_) { return null; }
}

async function blobPut(data) {
  try {
    await put('config.json', JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
  } catch (e) { console.error('SDK cfgBlobPut error: ' + (e.message || e)); }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') {
    var cfg = await readConfig();
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
    var cfg = await readConfig();
    var allowedKeys = ['iban', 'name', 'phone', 'whatsapp'];
    var changed = [];
    for (var k of allowedKeys) {
      if (body[k] !== undefined && typeof body[k] === 'string') {
        cfg[k] = body[k].trim();
        changed.push(k);
      }
    }
    if (changed.length === 0) return res.status(400).json({ success: false, error: 'Guncellenecek deger bulunamadi.' });
    await writeConfig(cfg);
    return res.status(200).json({ success: true, updated: changed, message: 'Guncellendi: ' + changed.join(', ') });
  }
  return res.status(405).json({ success: false, error: 'Method not allowed' });
};
