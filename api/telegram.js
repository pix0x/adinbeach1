const fs = require('fs');
const path = require('path');
const { get, put } = require('@vercel/blob');

const TMP_PATH = '/tmp/config.json';
const CFG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const STATE_PATH = '/tmp/telegram_states.json';
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

  // 2. /tmp/config.json (cache)
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
    const file = JSON.parse(fs.readFileSync(CFG_PATH, 'utf-8'));
    for (const k of ['iban', 'name', 'phone', 'whatsapp']) {
      if (!cfg[k] && file[k]) cfg[k] = file[k];
    }
  } catch (_) {}

  return cfg;
}

let lastBlobError = '';

async function writeConfig(config) {
  const json = JSON.stringify(config, null, 2);

  // 1. Blob store (kalici)
  try {
    lastBlobError = '';
    await put(BLOB_PATH, json, { access: 'private', addRandomSuffix: false });
  } catch (e) {
    lastBlobError = e.message;
    console.error('Blob write failed:', e.message);
  }

  // 2. /tmp (cache)
  try {
    const tmpDir = path.dirname(TMP_PATH);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(TMP_PATH, json, 'utf-8');
  } catch (_) {}

  // 3. data/config.json (Vercel'de read-only)
  try {
    const dir = path.dirname(CFG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CFG_PATH, json, 'utf-8');
  } catch (_) {}
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')); } catch (_) {}
  return {};
}

function writeState(state) {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state), 'utf-8');
  } catch (_) {}
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Telegram bot webhook active' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    lastBlobError = '';
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const update = JSON.parse(raw);

    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const token = process.env.TELEGRAM_BOT_TOKEN || '';

    if (!token) {
      return res.status(200).json({ ok: true });
    }

    const config = await readConfig();
    const states = readState();
    const pending = states[chatId];
    let reply = '';

    // Iki adimli akis: IBAN'dan sonra isim bekleniyor
    if (pending && pending.action === 'awaiting_name' && !text.startsWith('/')) {
      config.name = text;
      await writeConfig(config);
      delete states[chatId];
      writeState(states);
      reply = 'Hesap sahibi kaydedildi:\n<b>' + text + '</b>\n\nIBAN ve isim bilgisi guncellendi.';
    }

    else if (text.startsWith('/start')) {
      reply = 'Merhaba! Ben Adin Beach Hotel botuyum.\n\n';
      reply += 'Kullanilabilir komutlar:\n';
      reply += '/iban - IBAN ve hesap sahibi bilgisini goster veya guncelle\n';
      reply += '/tel - Telefon numarasini goster veya guncelle\n';
      reply += '/whatsapp - WhatsApp numarasini goster veya guncelle\n';
      reply += '/config - Tum yapilandirmayi goster';
    }

    else if (text.startsWith('/config')) {
      reply = '<b>Mevcut Yapilandirma</b>\n\n';
      reply += '<b>IBAN:</b> ' + (config.iban || '(ayarlanmamis)') + '\n';
      reply += '<b>Hesap Sahibi:</b> ' + (config.name || '(belirtilmemis)') + '\n';
      reply += '<b>Telefon:</b> ' + (config.phone || '(ayarlanmamis)') + '\n';
      reply += '<b>WhatsApp:</b> ' + (config.whatsapp || '(ayarlanmamis)');
    }

    else if (text.startsWith('/iban')) {
      const val = text.replace('/iban', '').trim();
      if (!val) {
        reply = '<b>IBAN:</b> ' + (config.iban || '(ayarlanmamis)') + '\n';
        reply += '<b>Hesap Sahibi:</b> ' + (config.name || '(belirtilmemis)') + '\n\n';
        reply += 'Guncellemek icin:\n<code>/iban TRxx xxxx xxxx xxxx xxxx xxxx xx</code>\n\nIBAN girdikten sonra hesap sahibinin adini da yazmaniz istenecek.';
      } else {
        config.iban = val;
        await writeConfig(config);
        states[chatId] = { action: 'awaiting_name' };
        writeState(states);
        reply = 'IBAN guncellendi:\n<code>' + val + '</code>\n\nSimdi <b>hesap sahibinin adini ve soyadini</b> yazin:';
      }
    }

    else if (text.startsWith('/tel')) {
      const val = text.replace('/tel', '').trim();
      if (!val) {
        reply = '<b>Telefon:</b> ' + (config.phone || '(ayarlanmamis)') + '\n\n';
        reply += 'Guncellemek icin:\n<code>/tel +90 5xx xxx xx xx</code>';
      } else {
        config.phone = val;
        await writeConfig(config);
        reply = 'Telefon guncellendi:\n' + val;
      }
    }

    else if (text.startsWith('/whatsapp')) {
      const val = text.replace('/whatsapp', '').trim();
      if (!val) {
        reply = '<b>WhatsApp:</b> ' + (config.whatsapp || '(ayarlanmamis)') + '\n\n';
        reply += 'Guncellemek icin:\n<code>/whatsapp +90 5xx xxx xx xx</code>';
      } else {
        config.whatsapp = val;
        await writeConfig(config);
        reply = 'WhatsApp guncellendi:\n' + val;
      }
    }

    else if (text.startsWith('/isim')) {
      const val = text.replace('/isim', '').trim();
      if (!val) {
        reply = '<b>Hesap Sahibi:</b> ' + (config.name || '(belirtilmemis)') + '\n\n';
        reply += 'Guncellemek icin:\n<code>/isim Ad Soyad</code>';
      } else {
        config.name = val;
        await writeConfig(config);
        reply = 'Hesap sahibi guncellendi:\n<b>' + val + '</b>';
      }
    }

    else {
      reply = 'Bilinmeyen komut. Kullanilabilir komutlar: /iban, /tel, /whatsapp, /isim, /config';
    }

    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'HTML' }),
    });

    return res.status(200).json({ ok: true, blobError: lastBlobError || undefined });

  } catch (err) {
    return res.status(200).json({ ok: true, error: err.message });
  } finally {
    lastBlobError = '';
  }
};
