const fs = require('fs');
const path = require('path');

function readConfig() {
  const TMP_PATH = '/tmp/config.json';
  const CFG_PATH = path.join(__dirname, '..', 'data', 'config.json');
  try { if (fs.existsSync(TMP_PATH)) return JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8')); } catch (_) {}
  try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf-8')); } catch (_) {}
  return { iban: '', name: '', phone: '', whatsapp: '' };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let raw = '';
    for await (const chunk of req) raw += chunk;

    let body;
    try { body = JSON.parse(raw); }
    catch {
      return res.status(400).json({ message: 'Geçersiz istek formatı.' });
    }

    const oda     = (body.oda     || '').trim();
    const giris   = (body.giris   || '').trim();
    const cikis   = (body.cikis   || '').trim();
    const mail    = (body.mail    || '').trim();
    const telefon = (body.telefon || '').trim();
    const notlar  = (body.not     || '').trim();
    const yetiskin = Array.isArray(body.yetiskin) ? body.yetiskin.filter(Boolean) : [];
    const cocuk   = Array.isArray(body.cocuk) ? body.cocuk.filter(Boolean) : [];
    const odemeYontemi = (body.odeme_yontemi || 'credit').trim().toLowerCase();
    const toplamTutar = parseFloat(body.toplam_tutar) || 0;

    // Validation
    const errors = [];
    if (!giris)   errors.push('Giriş tarihi zorunludur.');
    if (!cikis)   errors.push('Çıkış tarihi zorunludur.');
    if (!oda)     errors.push('Oda tipi seçiniz.');
    if (!mail && !telefon) errors.push('E-posta veya telefon alanından en az birini doldurun.');

    if (errors.length) {
      return res.status(400).json({ message: errors.join('<br>') });
    }

    const config = readConfig();
    const isHavale = odemeYontemi === 'havale' || odemeYontemi === 'transfer';

    // Telegram bildirimi
    const token  = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID   || '';
    let telegramOk = false;

    if (token && chatId) {
      let msg = `<b>🛎 YENİ REZERVASYON TALEBİ (Nuxt)</b>\n\n`;
      msg += `<b>🏠 Oda:</b> ${oda}\n`;
      msg += `<b>📅 Giriş:</b> ${giris}\n`;
      msg += `<b>📅 Çıkış:</b> ${cikis}\n`;
      msg += `<b>👤 Yetişkin:</b> ${yetiskin.length}\n`;
      if (yetiskin.length) msg += `<b>Yetişkinler:</b> ${yetiskin.join(', ')}\n`;
      if (cocuk.length)    msg += `<b>🧒 Çocuklar:</b> ${cocuk.join(', ')}\n`;
      if (mail)    msg += `<b>📧 E-posta:</b> ${mail}\n`;
      if (telefon) msg += `<b>📞 Telefon:</b> ${telefon}\n`;
      msg += `<b>💳 Ödeme:</b> ${isHavale ? 'Havale/EFT' : 'Kredi Kartı'}\n`;
      if (toplamTutar > 0) msg += `<b>💰 Tutar:</b> ${toplamTutar.toLocaleString('tr-TR')} TL\n`;
      if (isHavale && config.iban) {
        msg += `\n<b>🏦 IBAN:</b> ${config.iban}\n`;
        if (config.name) msg += `<b>👤 Hesap Sahibi:</b> ${config.name}\n`;
      }
      if (notlar)  msg += `\n<b>📝 Not:</b>\n${notlar}\n`;
      if (config.phone) msg += `\n<b>📞 Tel:</b> ${config.phone}`;
      if (config.whatsapp) msg += `\n<b>📱 WhatsApp:</b> ${config.whatsapp}`;
      msg += `\n⏱ ${new Date().toLocaleString('tr-TR')}`;

      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
      });
      const data = await resp.json();
      telegramOk = data.ok === true;
    }

    if (telegramOk || !token) {
      return res.status(200).json({
        id: 'OK',
        iban: isHavale ? (config.iban || '') : undefined
      });
    } else {
      return res.status(500).json({ message: 'Telegram bildirimi gönderilemedi.' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
