module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Debug: ne geliyor?
    const info = {
      contentType: req.headers['content-type'],
      bodyType: typeof req.body,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      bodyIsObject: typeof req.body === 'object' && !Buffer.isBuffer(req.body),
      bodyKeys: typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? Object.keys(req.body) : [],
      bodyPreview: String(req.body).substring(0, 200),
    };

    // Body parse
    let body = {};
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf-8');
      body = JSON.parse(str);
    } else if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    }

    const giris   = (body.giris   || '').trim();
    const cikis   = (body.cikis   || '').trim();
    const odaTipi = (body.oda_tipi || '').trim();
    const email   = (body.email   || '').trim();
    const telefon = (body.telefon || '').trim();

    const errors = [];
    if (!giris)   errors.push('Giriş tarihi zorunludur.');
    if (!cikis)   errors.push('Çıkış tarihi zorunludur.');
    if (!odaTipi) errors.push('Oda tipi seçiniz.');
    if (!email && !telefon) errors.push('E-posta veya telefon alanından en az birini doldurun.');

    if (errors.length) {
      return res.status(400).json({ success: false, error: errors.join('<br>'), debug: info });
    }

    // Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || '';

    let telegramOk = false;
    if (token && chatId) {
      let msg = `<b>🛎 YENİ REZERVASYON TALEBİ</b>\n\n`;
      msg += `<b>📅 Giriş:</b> ${giris}\n<b>📅 Çıkış:</b> ${cikis}\n`;
      msg += `<b>🏠 Oda:</b> ${odaTipi}\n`;
      msg += `<b>📞 İletişim:</b> ${email} ${telefon}\n`;
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
      return res.status(200).json({ success: true, message: 'Rezervasyon talebiniz alındı!' });
    } else {
      return res.status(500).json({ success: false, error: 'Telegram hatası', debug: info });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
};
