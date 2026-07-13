// ============================================================
// Adin Beach Hotel — Rezervasyon API (Vercel Serverless)
// POST /api/rezervasyon  →  Telegram bildirimi
// ============================================================

module.exports = async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Yalnızca POST isteği kabul edilir.' });
  }

  try {
    const CFG = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID   || '',
    };

    // --- Ham body'yi oku ---
    let raw = '';
    if (req.body) {
      if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf-8');
      else if (typeof req.body === 'object') raw = JSON.stringify(req.body);
      else raw = String(req.body);
    }

    // Body'yi JSON olarak parse et
    let body = {};
    const ct = req.headers['content-type'] || '';
    if (ct.includes('application/json')) {
      try { body = JSON.parse(raw); } catch { body = {}; }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const qs = new URLSearchParams(raw);
      for (const [k, v] of qs) body[k] = v;
    } else {
      // Deny: JSON olarak parse dene
      try { body = JSON.parse(raw); } catch { body = {}; }
    }

    const giris   = (body.giris   || '').trim();
    const cikis   = (body.cikis   || '').trim();
    const odaTipi = (body.oda_tipi || '').trim();
    const email   = (body.email   || '').trim();
    const telefon = (body.telefon || '').trim();
    const notlar  = (body.not     || '').trim();
    const yetiskinSayisi = Math.min(Math.max(parseInt(body.yetiskin_sayisi) || 1, 1), 5);
    const cocukSayisi    = Math.min(Math.max(parseInt(body.cocuk_sayisi)    || 0, 0), 5);

    // --- Doğrulama ---
    const errors = [];
    if (!giris)   errors.push('Giriş tarihi zorunludur.');
    if (!cikis)   errors.push('Çıkış tarihi zorunludur.');
    if (!odaTipi) errors.push('Oda tipi seçiniz.');
    if (!email && !telefon) errors.push('E-posta veya telefon alanından en az birini doldurun.');

    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join('<br>') });
    }

    // --- Misafir adları ---
    const misafirler = [];
    for (let i = 1; i <= Math.max(yetiskinSayisi, 2); i++) {
      const ad = (body[`yetiskin_${i}`] || '').trim();
      if (ad) misafirler.push(`• ${ad}`);
    }

    // --- Telegram mesajı ---
    let msg = `<b>🛎 YENİ REZERVASYON TALEBİ</b>\n\n`;
    msg += `<b>📅 Giriş:</b> ${giris}\n`;
    msg += `<b>📅 Çıkış:</b> ${cikis}\n`;
    msg += `<b>🏠 Oda Tipi:</b> ${odaTipi}\n`;
    msg += `<b>👤 Yetişkin:</b> ${yetiskinSayisi}\n`;
    if (cocukSayisi > 0) msg += `<b>🧒 Çocuk:</b> ${cocukSayisi}\n`;

    if (misafirler.length) {
      msg += `\n<b>👥 Misafirler:</b>\n${misafirler.join('\n')}\n`;
    }

    msg += `\n<b>📞 İletişim:</b>\n`;
    if (email)   msg += `• E-posta: ${email}\n`;
    if (telefon) msg += `• Telefon: ${telefon}\n`;
    if (notlar)  msg += `\n<b>📝 Not:</b>\n${notlar}\n`;
    msg += `\n⏱ ${new Date().toLocaleString('tr-TR')}`;

    // --- Telegram'a gönder ---
    let telegramOk = false;
    if (CFG.TELEGRAM_BOT_TOKEN && CFG.TELEGRAM_CHAT_ID) {
      const url = `https://api.telegram.org/bot${CFG.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CFG.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' }),
      });
      const data = await resp.json();
      telegramOk = data.ok === true;
    }

    if (telegramOk || !CFG.TELEGRAM_BOT_TOKEN) {
      return res.status(200).json({
        success: true,
        message: 'Rezervasyon talebiniz başarıyla alındı! En kısa sürede sizinle iletişime geçeceğiz.',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Bir hata oluştu, lütfen daha sonra tekrar deneyiniz.',
      });
    }
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ success: false, error: 'Sunucu hatası: ' + err.message });
  }
};
