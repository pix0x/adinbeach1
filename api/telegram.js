const fs = require('fs');
const path = require('path');

const TMP_PATH = '/tmp/config.json';
const CFG_PATH = path.join(__dirname, '..', 'data', 'config.json');

function readConfig() {
  try { if (fs.existsSync(TMP_PATH)) return JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8')); } catch (_) {}
  try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf-8')); } catch (_) {}
  return { iban: '', phone: '', whatsapp: '' };
}

function writeConfig(config) {
  const dir = path.dirname(CFG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(config, null, 2);
  try {
    const tmpDir = path.dirname(TMP_PATH);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(TMP_PATH, json, 'utf-8');
  } catch (_) {}
  fs.writeFileSync(CFG_PATH, json, 'utf-8');
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Telegram bot webhook active' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const update = JSON.parse(raw);

    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const token = process.env.TELEGRAM_BOT_TOKEN || '';

    if (!token) {
      return res.status(200).json({ ok: true });
    }

    const config = readConfig();
    let reply = '';

    if (text.startsWith('/start')) {
      reply = 'Merhaba! Ben Adin Beach Hotel botuyum.\n\n';
      reply += 'Kullanılabilir komutlar:\n';
      reply += '/iban - IBAN bilgisini göster veya güncelle\n';
      reply += '/tel - Telefon numarasını göster veya güncelle\n';
      reply += '/whatsapp - WhatsApp numarasını göster veya güncelle\n';
      reply += '/config - Tüm yapılandırmayı göster';
    }

    else if (text.startsWith('/config')) {
      reply = '<b>Mevcut Yapılandırma</b>\n\n';
      reply += `<b>IBAN:</b> ${config.iban || '(ayarlanmamış)'}\n`;
      reply += `<b>Telefon:</b> ${config.phone || '(ayarlanmamış)'}\n`;
      reply += `<b>WhatsApp:</b> ${config.whatsapp || '(ayarlanmamış)'}`;
    }

    else if (text.startsWith('/iban')) {
      const val = text.replace('/iban', '').trim();
      if (!val) {
        reply = `<b>IBAN:</b> ${config.iban || '(ayarlanmamış)'}\n\n`;
        reply += 'Güncellemek için:\n<code>/iban TRxx xxxx xxxx xxxx xxxx xxxx xx</code>';
      } else {
        config.iban = val;
        writeConfig(config);
        reply = `IBAN güncellendi:\n<code>${val}</code>`;
      }
    }

    else if (text.startsWith('/tel')) {
      const val = text.replace('/tel', '').trim();
      if (!val) {
        reply = `<b>Telefon:</b> ${config.phone || '(ayarlanmamış)'}\n\n`;
        reply += 'Güncellemek için:\n<code>/tel +90 5xx xxx xx xx</code>';
      } else {
        config.phone = val;
        writeConfig(config);
        reply = `Telefon güncellendi:\n${val}`;
      }
    }

    else if (text.startsWith('/whatsapp')) {
      const val = text.replace('/whatsapp', '').trim();
      if (!val) {
        reply = `<b>WhatsApp:</b> ${config.whatsapp || '(ayarlanmamış)'}\n\n`;
        reply += 'Güncellemek için:\n<code>/whatsapp +90 5xx xxx xx xx</code>';
      } else {
        config.whatsapp = val;
        writeConfig(config);
        reply = `WhatsApp güncellendi:\n${val}`;
      }
    }

    else {
      reply = 'Bilinmeyen komut. Kullanılabilir komutlar: /iban, /tel, /whatsapp, /config';
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'HTML' }),
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(200).json({ ok: true, error: err.message });
  }
};
