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
      // URL-encoded format dene
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

    // Validation
    const errors = [];
    if (!giris)   errors.push('Giriş tarihi zorunludur.');
    if (!cikis)   errors.push('Çıkış tarihi zorunludur.');
    if (!odaTipi) errors.push('Oda tipi seçiniz.');
    if (!email && !telefon) errors.push('E-posta veya telefon alanından en az birini doldurun.');

    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join('<br>') });
    }

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
      if (notlar)  msg += `\n<b>📝 Not:</b>\n${notlar}\n`;
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
        success: true,
        message: 'Rezervasyon talebiniz başarıyla alındı! En kısa sürede sizinle iletişime geçeceğiz.',
      });
    } else {
      return res.status(500).json({ success: false, error: 'Telegram bildirimi gönderilemedi.' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
