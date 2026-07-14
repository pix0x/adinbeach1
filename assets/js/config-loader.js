// Config yükleyici — telefon ve WhatsApp numaralarını /api/config'den alır ve DOM'da günceller
(function() {
  fetch('/api/config').then(function(r) { return r.json(); }).then(function(cfg) {
    if (!cfg.success || !cfg.config) return;
    var c = cfg.config;
    if (!c.phone && !c.whatsapp) return;

    // Telefon numarasını normalize et
    function cleanPhone(num) {
      return num.replace(/[\s\(\)\-]/g, '');
    }

    var cleanPhoneVal = c.phone ? cleanPhone(c.phone) : '';
    var cleanWhatsappVal = c.whatsapp ? cleanPhone(c.whatsapp) : '';

    // 1. Tüm <a href="tel:..."> linklerini güncelle
    if (c.phone) {
      var telLinks = document.querySelectorAll('a[href^="tel:"]');
      for (var i = 0; i < telLinks.length; i++) {
        telLinks[i].href = 'tel:' + cleanPhoneVal;
        // Link içindeki metni de güncelle (telefon numarası görünen kısım)
        // İçindeki tüm text node'larını temizle, sadece telefon numarasını koy
        var textNodes = [];
        for (var j = 0; j < telLinks[i].childNodes.length; j++) {
          if (telLinks[i].childNodes[j].nodeType === 3) {
            textNodes.push(telLinks[i].childNodes[j]);
          }
        }
        // En son text node'unu bul (içinde telefon numarası olan)
        for (var j = textNodes.length - 1; j >= 0; j--) {
          if (/\d/.test(textNodes[j].textContent)) {
            textNodes[j].textContent = c.phone;
            break;
          }
        }
      }
    }

    // 2. Tüm <a href="...wa.me/..."> linklerini güncelle
    if (c.whatsapp) {
      var waLinks = document.querySelectorAll('a[href*="wa.me/"]');
      for (var i = 0; i < waLinks.length; i++) {
        waLinks[i].href = 'https://wa.me/' + cleanWhatsappVal;
      }
    }

    // 3. Tüm <a href tel hariç) metin düğümlerindeki numaraları güncelle
    // (step 1 zaten tel: linklerini halleder)
  }).catch(function() {
    // Config yüklenemezse sessizce geç
  });
})();
