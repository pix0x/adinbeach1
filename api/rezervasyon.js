// ============================================================
// Adin Beach Hotel — Rezervasyon API (Vercel Serverless)
// POST /api/rezervasyon  →  Telegram + WhatsApp bildirimi
// ============================================================

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Yalnızca POST isteği kabul edilir.' });
  }

  // --- Varsayılan config: önce env var, yoksa sabit ---
  const CFG = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID   || '',
    WHATSAPP_NUMBER:    process.env.WHATSAPP_NUMBER    || '',
    WHATSAPP_API_KEY:   process.env.WHATSAPP_API_KEY   || '',
    WHATSAPP_ENABLED:   process.env.WHATSAPP_ENABLED   === 'true',
    PHONE:              process.env.PHONE              || '+90 242 439 49 18',
  };

  // --- Body parse (Vercel otomatik JSON/urlencoded çözer) ---
  const body = req.body || {};

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

  // --- Misafir adlarını topla ---
  const misafirler = [];
  for (let i = 1; i <= Math.max(yetiskinSayisi, 2); i++) {
    const ad = (body[`yetiskin_${i}`] || '').trim();
    if (ad) misafirler.push(`• ${ad}`);
  }

  // --- Telegram mesajı oluştur (HTML format) ---
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

  if (notlar) {
    msg += `\n<b>📝 Not:</b>\n${notlar}\n`;
  }

  msg += `\n⏱ ${new Date().toLocaleString('tr-TR')}`;

  // --- Telegram'a gönder ---
  let telegramOk = false;
  if (CFG.TELEGRAM_BOT_TOKEN && CFG.TELEGRAM_CHAT_ID) {
    try {
      const url = `https://api.telegram.org/bot${CFG.TELEGRAM_BOT_TOKEN}/sendMessage`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CFG.TELEGRAM_CHAT_ID,
          text: msg,
          parse_mode: 'HTML',
        }),
      });
      const data = await resp.json();
      telegramOk = data.ok === true;
    } catch (err) {
      console.error('Telegram error:', err);
    }
  }

  // --- WhatsApp bildirimi (CallMeBot) ---
  if (CFG.WHATSAPP_ENABLED && CFG.WHATSAPP_NUMBER && CFG.WHATSAPP_API_KEY) {
    try {
      let waMsg = `🛎 YENİ REZERVASYON TALEBİ%0A%0A`;
      waMsg += `Giriş: ${giris}%0A`;
      waMsg += `Çıkış: ${cikis}%0A`;
      waMsg += `Oda: ${odaTipi}%0A`;
      waMsg += `Yetişkin: ${yetiskinSayisi}%0A`;
      if (cocukSayisi > 0) waMsg += `Çocuk: ${cocukSayisi}%0A`;
      if (email) waMsg += `E-posta: ${email}%0A`;
      if (telefon) waMsg += `Telefon: ${telefon}%0A`;
      if (notlar) waMsg += `Not: ${notlar}%0A`;
      waMsg += `Tarih: ${new Date().toLocaleString('tr-TR')}`;

      const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${CFG.WHATSAPP_NUMBER}&text=${waMsg}&apikey=${CFG.WHATSAPP_API_KEY}`;
      await fetch(waUrl, { method: 'GET' });
    } catch (err) {
      console.error('WhatsApp error:', err);
    }
  }

  // --- Yanıt ---
  if (telegramOk || !CFG.TELEGRAM_BOT_TOKEN) {
    // Bot token yoksa (dev ortamı) da başarılı say
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
}
