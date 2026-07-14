const fs = require('fs');
const path = require('path');
const { put, get } = require('@vercel/blob');

const TMP_PATH = '/tmp/config.json';
const CFG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const STATE_PATH = '/tmp/telegram_states.json';

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
  } catch (e) { console.error('SDK blobPut error: ' + (e.message || e)); }
}

// ---

function readConfig() {
  try {
    if (fs.existsSync(TMP_PATH)) {
      var tmp = JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8'));
      if (tmp.phone || tmp.whatsapp || tmp.iban || tmp.name) return tmp;
    }
  } catch (_) {}
  try {
    var file = JSON.parse(fs.readFileSync(CFG_PATH, 'utf-8'));
    if (file.phone || file.whatsapp || file.iban || file.name) return file;
  } catch (_) {}
  return { iban: process.env.CONFIG_IBAN || '', name: process.env.CONFIG_NAME || '', phone: process.env.CONFIG_PHONE || '', whatsapp: process.env.CONFIG_WHATSAPP || '' };
}

function writeConfigLocal(config) {
  var json = JSON.stringify(config, null, 2);
  try {
    var d = path.dirname(TMP_PATH);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(TMP_PATH, json, 'utf-8');
  } catch (_) {}
  try {
    var d = path.dirname(CFG_PATH);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(CFG_PATH, json, 'utf-8');
  } catch (_) {}
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')); } catch (_) {}
  return {};
}

function writeState(state) {
  try {
    var d = path.dirname(STATE_PATH);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state), 'utf-8');
  } catch (_) {}
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).json({ ok: true, message: 'Telegram bot webhook active' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var raw = '';
    for await (var chunk of req) raw += chunk;
    var update = JSON.parse(raw);
    var message = update.message || update.edited_message;
    if (!message || !message.text) return res.status(200).json({ ok: true });

    var chatId = String(message.chat.id);
    var text = message.text.trim();
    var token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!token) return res.status(200).json({ ok: true });

    var config = readConfig();
    var states = readState();
    var pending = states[chatId];
    var reply = '';

    if (pending && pending.action === 'awaiting_name' && !text.startsWith('/')) {
      config.name = text;
      writeConfigLocal(config);
      await blobPut(config);
      delete states[chatId];
      writeState(states);
      reply = 'Hesap sahibi kaydedildi:\n<b>' + text + '</b>\n\nIBAN ve isim bilgisi guncellendi.';
    } else if (text.startsWith('/start')) {
      reply = 'Merhaba! Ben Adin Beach Hotel botuyum.\n\nKullanilabilir komutlar:\n/iban - IBAN ve hesap sahibi bilgisini goster veya guncelle\n/tel - Telefon numarasini goster veya guncelle\n/whatsapp - WhatsApp numarasini goster veya guncelle\n/config - Tum yapilandirmayi goster';
    } else if (text.startsWith('/config')) {
      reply = '<b>Mevcut Yapilandirma</b>\n\n<b>IBAN:</b> ' + (config.iban || '(ayarlanmamis)') + '\n<b>Hesap Sahibi:</b> ' + (config.name || '(belirtilmemis)') + '\n<b>Telefon:</b> ' + (config.phone || '(ayarlanmamis)') + '\n<b>WhatsApp:</b> ' + (config.whatsapp || '(ayarlanmamis)');
    } else if (text.startsWith('/iban')) {
      var val = text.replace('/iban', '').trim();
      if (!val) {
        reply = '<b>IBAN:</b> ' + (config.iban || '(ayarlanmamis)') + '\n<b>Hesap Sahibi:</b> ' + (config.name || '(belirtilmemis)') + '\n\nGuncellemek icin:\n<code>/iban TRxx xxxx xxxx xxxx xxxx xxxx xx</code>\n\nIBAN girdikten sonra hesap sahibinin adini da yazmaniz istenecek.';
      } else {
        config.iban = val;
        writeConfigLocal(config);
        await blobPut(config);
        states[chatId] = { action: 'awaiting_name' };
        writeState(states);
        reply = 'IBAN guncellendi:\n<code>' + val + '</code>\n\nSimdi <b>hesap sahibinin adini ve soyadini</b> yazin:';
      }
    } else if (text.startsWith('/tel')) {
      var val = text.replace('/tel', '').trim();
      if (!val) {
        reply = '<b>Telefon:</b> ' + (config.phone || '(ayarlanmamis)') + '\n\nGuncellemek icin:\n<code>/tel +90 5xx xxx xx xx</code>';
      } else {
        config.phone = val;
        writeConfigLocal(config);
        await blobPut(config);
        reply = 'Telefon guncellendi:\n' + val;
      }
    } else if (text.startsWith('/whatsapp')) {
      var val = text.replace('/whatsapp', '').trim();
      if (!val) {
        reply = '<b>WhatsApp:</b> ' + (config.whatsapp || '(ayarlanmamis)') + '\n\nGuncellemek icin:\n<code>/whatsapp +90 5xx xxx xx xx</code>';
      } else {
        config.whatsapp = val;
        writeConfigLocal(config);
        await blobPut(config);
        reply = 'WhatsApp guncellendi:\n' + val;
      }
    } else if (text.startsWith('/isim')) {
      var val = text.replace('/isim', '').trim();
      if (!val) {
        reply = '<b>Hesap Sahibi:</b> ' + (config.name || '(belirtilmemis)') + '\n\nGuncellemek icin:\n<code>/isim Ad Soyad</code>';
      } else {
        config.name = val;
        writeConfigLocal(config);
        await blobPut(config);
        reply = 'Hesap sahibi guncellendi:\n<b>' + val + '</b>';
      }
    } else {
      reply = 'Bilinmeyen komut. Kullanilabilir komutlar: /iban, /tel, /whatsapp, /isim, /config';
    }

    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'HTML' }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: true, error: err.message });
  }
};
