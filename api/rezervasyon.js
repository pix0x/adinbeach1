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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let raw = '';
    for await (const chunk of req) raw += chunk;

    let body;
    try { body = JSON.parse(raw); }
    catch {
      try {
        body = {};
        const qs = new URLSearchParams(raw);
        for (const [k, v] of qs) body[k] = v;
      } catch {
        return res.status(400).json({ success: false, error: 'Geçersiz istek formatı.' });
      }
    }

    const giris   = (body.giris   || '').trim();
    const cikis   = (body.cikis   || '').trim();
    const odaTipi = (body.oda_tipi || '').trim();
    const email   = (body.email   || '').trim();
    const telefon = (body.telefon || '').trim();
    const notlar  = (body.not     || '').trim();
    const yetiskinSayisi = Math.min(Math.max(parseInt(body.yetiskin_sayisi) || 1, 1), 5);
    const odemeYontemi = (body.odeme_yontemi || 'credit').trim().toLowerCase();
    const toplamTutar = parseFloat(body.toplam_tutar) || 0;

    // Validation
    const errors = [];
    if (!giris)   errors.push('Giriş tarihi zorunludur.');
    if (!cikis)   errors.push('Çıkış tarihi zorunludur.');
    if (!odaTipi) errors.push('Oda tipi seçiniz.');
    if (!email && !telefon) errors.push('E-posta veya telefon alanından en az birini doldurun.');

    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join('<br>') });
    }

    const config = readConfig();
    const isHavale = odemeYontemi === 'havale' || odemeYontemi === 'transfer';

    // Telegram bildirimi
    const token  = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID   || '';
    let telegramOk = false;

    if (token && chatId) {
      let msg = `<b>🛎 YENİ REZERVASYON TALEBİ</b>\n\n`;
      msg += `<b>📅 Giriş:</b> ${giris}\n`;
      msg += `<b>📅 Çıkış:</b> ${cikis}\n`;
      msg += `<b>🏠 Oda Tipi:</b> ${odaTipi}\n`;
      msg += `<b>👤 Yetişkin:</b> ${yetiskinSayisi}\n`;
      if (email)   msg += `<b>📧 E-posta:</b> ${email}\n`;
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

    // Response with IBAN if havale
    let responseMsg = 'Rezervasyon talebiniz başarıyla alındı! En kısa sürede sizinle iletişime geçeceğiz.';
    if (isHavale && config.iban) {
      responseMsg += `\n\nHavale ile ödeme yapmak için IBAN:\n${config.iban}`;
      if (config.name) responseMsg += `\nAlıcı: ${config.name}`;
    }

    if (telegramOk || !token) {
      return res.status(200).json({
        success: true,
        message: responseMsg,
        iban: isHavale ? (config.iban || '') : undefined
      });
    } else {
      return res.status(500).json({ success: false, error: 'Telegram bildirimi gönderilemedi.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
