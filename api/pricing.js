// --- Fiyatlandırma Yapılandırması ---
const PRICING = {
  currency: 'TL',
  baseGuests: 2,

  // Sezon tanımları (gün-ay aralığı)
  seasons: [
    { id: 'low',  label: 'Düşük Sezon', months: [{ from: '01-01', to: '03-31' }, { from: '11-01', to: '12-31' }] },
    { id: 'mid',  label: 'Orta Sezon',  months: [{ from: '04-01', to: '05-31' }, { from: '10-01', to: '10-31' }] },
    { id: 'high', label: 'Yüksek Sezon', months: [{ from: '06-01', to: '09-30' }] }
  ],

  // Oda fiyatları (sezon başına gecelik TL)
  rooms: [
    { id: 'premium-dubleks-royal',        name: 'Deniz Manzaralı Premium Dubleks Royal Oda',     rates: { low: 4500, mid: 6500, high: 9500 } },
    { id: 'premium-dubleks-superior',      name: 'Deniz Manzaralı Premium Dubleks Superior Oda', rates: { low: 4000, mid: 5800, high: 8500 } },
    { id: 'premium-suit',                  name: 'Deniz Manzaralı Premium Suit Oda',             rates: { low: 3500, mid: 5000, high: 7500 } },
    { id: 'premium-aile',                  name: 'Deniz Manzaralı Premium Aile Oda',             rates: { low: 3200, mid: 4600, high: 6800 } },
    { id: 'premium-connection',            name: 'Deniz Manzaralı Premium Connection Oda',       rates: { low: 3800, mid: 5500, high: 8000 } },
    { id: 'premium-standart',              name: 'Deniz Manzaralı Premium Standart Oda',         rates: { low: 2800, mid: 4000, high: 6000 } },
    { id: 'premium-engelli',               name: 'Deniz Manzaralı Premium Engelli Oda',          rates: { low: 2600, mid: 3800, high: 5500 } },
    { id: 'flora-oda',                     name: 'Bahçe Manzaralı Flora Oda',                    rates: { low: 2000, mid: 3000, high: 4500 } },
    { id: 'flora-connection',              name: 'Bahçe Manzaralı Flora Connection Oda',         rates: { low: 2500, mid: 3600, high: 5200 } },
    { id: 'flora-dublex',                  name: 'Bahçe Manzaralı Flora Dublex Oda',             rates: { low: 2800, mid: 4000, high: 5800 } },
    { id: 'flora-mercan',                  name: 'Bahçe & Deniz Manzaralı Flora Mercan',         rates: { low: 3000, mid: 4200, high: 6200 } },
    { id: 'flora-yasemin',                 name: 'Bahçe Manzaralı Flora Yasemin',                rates: { low: 2200, mid: 3200, high: 4800 } },
    { id: 'villa-gloria',                  name: 'Villa Gloria',                                 rates: { low: 8000, mid: 12000, high: 18000 } },
    { id: 'villa-magnolia',                name: 'Villa Magnolia',                               rates: { low: 10000, mid: 15000, high: 22000 } }
  ],

  // Ek ücretler (sezon başına gecelik TL)
  surcharges: {
    extraAdult: { low: 500, mid: 750, high: 1000 },
    childFreeAge: 6,
    childHalfAge: 12
  },

  // İndirim kuralları
  discounts: {
    longStay: [
      { minNights: 14, rate: 0.90, label: '%10 Uzun Konaklama İndirimi (14+ gece)' },
      { minNights: 7,  rate: 0.95, label: '%5 Haftalık Konaklama İndirimi (7+ gece)' }
    ],
    earlyBooking: [
      { minDaysAhead: 60, rate: 0.88, label: '%12 Erken Rezervasyon İndirimi (60+ gün)' },
      { minDaysAhead: 30, rate: 0.93, label: '%7 Erken Rezervasyon İndirimi (30+ gün)' }
    ]
  }
};

// --- Yardımcı Fonksiyonlar ---
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getSeason(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const md = `${m}-${d}`;
  for (const s of PRICING.seasons) {
    for (const r of s.months) {
      if (md >= r.from && md <= r.to) return s.id;
    }
  }
  return 'low';
}

function nightsBetween(a, b) {
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

// --- API Handler ---
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
    const body = JSON.parse(raw);

    const odaId    = (body.oda    || '').trim();
    const girisStr = (body.giris  || '').trim();
    const cikisStr = (body.cikis  || '').trim();
    const yetiskin = parseInt(body.yetiskin_sayisi || body.yetiskin || 2);
    const cocuk    = parseInt(body.cocuk_sayisi || body.cocuk || 0);

    if (!odaId)  return res.status(400).json({ success: false, error: 'Oda tipi seçiniz.' });
    if (!girisStr || !cikisStr) return res.status(400).json({ success: false, error: 'Giriş ve çıkış tarihlerini seçiniz.' });

    const giris = parseDate(girisStr);
    const cikis = parseDate(cikisStr);
    if (isNaN(giris.getTime()) || isNaN(cikis.getTime())) {
      return res.status(400).json({ success: false, error: 'Geçersiz tarih formatı.' });
    }
    if (cikis <= giris) {
      return res.status(400).json({ success: false, error: 'Çıkış tarihi giriş tarihinden sonra olmalıdır.' });
    }

    const nights = nightsBetween(giris, cikis);
    const room = PRICING.rooms.find(r => r.id === odaId || r.name === odaId);
    if (!room) return res.status(404).json({ success: false, error: 'Oda tipi bulunamadı.' });

    // Gecelik sezon kırılımı
    const daily = [];
    let seasonWeights = {};
    for (let i = 0; i < nights; i++) {
      const d = new Date(giris);
      d.setDate(d.getDate() + i);
      const s = getSeason(d);
      daily.push({ date: d.toISOString().split('T')[0], season: s, rate: room.rates[s] });
      seasonWeights[s] = (seasonWeights[s] || 0) + 1;
    }

    // Çoğunluk sezonu (ek ücretler için)
    const primarySeason = Object.entries(seasonWeights).sort((a, b) => b[1] - a[1])[0][0];

    const subtotal = daily.reduce((sum, d) => sum + d.rate, 0);
    const extraAdults = Math.max(0, yetiskin - PRICING.baseGuests);
    const extraAdultFee = PRICING.surcharges.extraAdult[primarySeason];
    const extraAdultTotal = extraAdults * extraAdultFee * nights;

    // Çocuk: 0-6 ücretsiz, 7-12 yarım ücret (ek yetişkin ücretinin %50'si)
    const childFee = Math.round(extraAdultFee * 0.5);
    const childTotal = cocuk * childFee * nights;

    let totalBeforeDiscount = subtotal + extraAdultTotal + childTotal;

    // İndirim hesaplama
    let discountRate = 1;
    let appliedDiscounts = [];

    // Uzun konaklama
    for (const rule of PRICING.discounts.longStay.sort((a, b) => b.minNights - a.minNights)) {
      if (nights >= rule.minNights && rule.rate < discountRate) {
        discountRate = rule.rate;
        appliedDiscounts.push(rule.label);
        break;
      }
    }

    // Erken rezervasyon
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysAhead = Math.round((giris - today) / (1000 * 60 * 60 * 24));
    for (const rule of PRICING.discounts.earlyBooking.sort((a, b) => b.minDaysAhead - a.minDaysAhead)) {
      if (daysAhead >= rule.minDaysAhead && rule.rate < discountRate) {
        discountRate = rule.rate;
        appliedDiscounts.push(rule.label);
        break;
      }
    }

    const discountAmount = Math.round(totalBeforeDiscount * (1 - discountRate));
    const totalPrice = Math.round(totalBeforeDiscount * discountRate);

    return res.status(200).json({
      success: true,
      currency: PRICING.currency,
      room: { id: room.id, name: room.name },
      dates: { checkIn: girisStr, checkOut: cikisStr, nights },
      guests: { adults: yetiskin, children: cocuk, baseGuests: PRICING.baseGuests },
      season: primarySeason,
      pricing: {
        dailyCount: daily.length,
        subtotal,
        extraAdultCount: extraAdults,
        extraAdultFee,
        extraAdultTotal,
        childFee,
        childTotal,
        totalBeforeDiscount,
        discounts: appliedDiscounts,
        discountAmount,
        total: totalPrice
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
