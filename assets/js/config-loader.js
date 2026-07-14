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
        var textNode = telLinks[i].childNodes;
        for (var j = 0; j < textNode.length; j++) {
          if (textNode[j].nodeType === 3) {
            textNode[j].textContent = textNode[j].textContent.replace(/[\d\s\(\)\+\-]{7,}/g, c.phone);
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

    // 3. Sosyal medya ikonlarının yanındaki +90 xxx ... metinlerini güncelle
    if (c.phone) {
      var allElements = document.querySelectorAll('a, span, div, p, li');
      for (var i = 0; i < allElements.length; i++) {
        var el = allElements[i];
        // Header/contact alanlarındaki numaraları değiştir (içinde +90 geçen kısa metinler)
        var html = el.innerHTML;
        if (typeof html === 'string' && html.indexOf('+90') !== -1 && html.length < 200) {
          // Sadece telefon formatındaki stringleri değiştir
          var newHtml = html.replace(/\+\d{2,3}[\s\d\(\)\-]{7,}/g, c.phone);
          if (newHtml !== html) {
            el.innerHTML = newHtml;
          }
        }
      }
    }
  }).catch(function() {
    // Config yüklenemezse sessizce geç
  });
})();
