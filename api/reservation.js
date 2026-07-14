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

    // Validation
    const errors = [];
    if (!giris)   errors.push('Giriş tarihi zorunludur.');
    if (!cikis)   errors.push('Çıkış tarihi zorunludur.');
    if (!oda)     errors.push('Oda tipi seçiniz.');
    if (!mail && !telefon) errors.push('E-posta veya telefon alanından en az birini doldurun.');

    if (errors.length) {
      return res.status(400).json({ message: errors.join('<br>') });
    }

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
      return res.status(200).json({ id: 'OK' });
    } else {
      return res.status(500).json({ message: 'Telegram bildirimi gönderilemedi.' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
