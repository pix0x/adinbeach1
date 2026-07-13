<?php
if (!function_exists('selected')) {
  function selected($field, $value) {
    return (isset($_POST[$field]) && $_POST[$field] === $value) ? 'selected' : '';
  }
}
?>
<form method="POST" action="">

  <!-- ===== TARİHLER ===== -->
  <div class="field-group">
    <div class="field-label" style="margin-bottom:.75rem">
      <span style="display:inline-flex;align-items:center;gap:.5rem">
        <span style="display:inline-block;width:1.5rem;height:1px;background:var(--gold-dim)"></span>
        Tarihler
      </span>
    </div>
    <div class="field-row">
      <div>
        <label class="field-label" for="giris">Giriş Tarihi *</label>
        <input type="date" id="giris" name="giris" class="field" required
               min="<?= date('Y-m-d') ?>"
               value="<?= htmlspecialchars($_POST['giris'] ?? '') ?>">
      </div>
      <div>
        <label class="field-label" for="cikis">Çıkış Tarihi *</label>
        <input type="date" id="cikis" name="cikis" class="field" required
               min="<?= date('Y-m-d', strtotime('+1 day')) ?>"
               value="<?= htmlspecialchars($_POST['cikis'] ?? '') ?>">
      </div>
    </div>
  </div>

  <!-- ===== ODA TİPİ ===== -->
  <div class="field-group">
    <div class="field-label" style="margin-bottom:.75rem">
      <span style="display:inline-flex;align-items:center;gap:.5rem">
        <span style="display:inline-block;width:1.5rem;height:1px;background:var(--gold-dim)"></span>
        Oda Tipi
      </span>
    </div>
    <label class="field-label" for="oda_tipi">Oda Tipi *</label>
    <select id="oda_tipi" name="oda_tipi" class="field" required>
      <option value="">Lütfen bir oda tipi seçin</option>
      <optgroup label="Premium Odalar">
        <option value="Deniz Manzaralı Premium Dubleks Royal Oda" <?= selected('oda_tipi', 'Deniz Manzaralı Premium Dubleks Royal Oda') ?>>Deniz Manzaralı Premium Dubleks Royal Oda</option>
        <option value="Deniz Manzaralı Premium Dubleks Superior Oda" <?= selected('oda_tipi', 'Deniz Manzaralı Premium Dubleks Superior Oda') ?>>Deniz Manzaralı Premium Dubleks Superior Oda</option>
        <option value="Deniz Manzaralı Premium Suit Oda" <?= selected('oda_tipi', 'Deniz Manzaralı Premium Suit Oda') ?>>Deniz Manzaralı Premium Suit Oda</option>
        <option value="Deniz Manzaralı Premium Aile Oda" <?= selected('oda_tipi', 'Deniz Manzaralı Premium Aile Oda') ?>>Deniz Manzaralı Premium Aile Oda</option>
        <option value="Deniz Manzaralı Premium Connection Oda" <?= selected('oda_tipi', 'Deniz Manzaralı Premium Connection Oda') ?>>Deniz Manzaralı Premium Connection Oda</option>
        <option value="Deniz Manzaralı Premium Standart Oda" <?= selected('oda_tipi', 'Deniz Manzaralı Premium Standart Oda') ?>>Deniz Manzaralı Premium Standart Oda</option>
        <option value="Deniz Manzaralı Premium Engelli Oda" <?= selected('oda_tipi', 'Deniz Manzaralı Premium Engelli Oda') ?>>Deniz Manzaralı Premium Engelli Oda</option>
      </optgroup>
      <optgroup label="Flora Odalar">
        <option value="Bahçe Manzaralı Flora Oda" <?= selected('oda_tipi', 'Bahçe Manzaralı Flora Oda') ?>>Bahçe Manzaralı Flora Oda</option>
        <option value="Bahçe Manzaralı Flora Connection Oda" <?= selected('oda_tipi', 'Bahçe Manzaralı Flora Connection Oda') ?>>Bahçe Manzaralı Flora Connection Oda</option>
        <option value="Bahçe Manzaralı Flora Dublex Oda" <?= selected('oda_tipi', 'Bahçe Manzaralı Flora Dublex Oda') ?>>Bahçe Manzaralı Flora Dublex Oda</option>
        <option value="Bahçe & Deniz Manzaralı Flora Mercan" <?= selected('oda_tipi', 'Bahçe & Deniz Manzaralı Flora Mercan') ?>>Bahçe &amp; Deniz Manzaralı Flora Mercan</option>
        <option value="Bahçe Manzaralı Flora Yasemin" <?= selected('oda_tipi', 'Bahçe Manzaralı Flora Yasemin') ?>>Bahçe Manzaralı Flora Yasemin</option>
      </optgroup>
      <optgroup label="Size Özel Villa">
        <option value="Villa Gloria" <?= selected('oda_tipi', 'Villa Gloria') ?>>Villa Gloria</option>
        <option value="Villa Magnolia" <?= selected('oda_tipi', 'Villa Magnolia') ?>>Villa Magnolia</option>
      </optgroup>
    </select>
  </div>

  <!-- ===== MİSAFİRLER ===== -->
  <div class="field-group">
    <div class="field-label" style="margin-bottom:.75rem">
      <span style="display:inline-flex;align-items:center;gap:.5rem">
        <span style="display:inline-block;width:1.5rem;height:1px;background:var(--gold-dim)"></span>
        Konaklayacak Misafirler
      </span>
    </div>

    <!-- Yetişkin Stepper -->
    <div class="stepper" data-min="1" data-max="5" data-target="yetiskin">
      <span class="stepper-label">Yetişkin <span>(1–5)</span></span>
      <div class="stepper-controls">
        <button type="button" class="stepper-btn" aria-label="Azalt">−</button>
        <span class="stepper-value">2</span>
        <button type="button" class="stepper-btn" aria-label="Arttır">+</button>
      </div>
    </div>
    <input type="hidden" name="yetiskin_sayisi" value="2" id="h_yetiskin_sayisi">
    <div class="guest-inputs" id="guest_yetiskin">
      <input type="text" name="yetiskin_1" class="field" placeholder="1. Yetişkin Ad Soyad" maxlength="24"
             value="<?= htmlspecialchars($_POST['yetiskin_1'] ?? '') ?>">
      <input type="text" name="yetiskin_2" class="field" placeholder="2. Yetişkin Ad Soyad" maxlength="24"
             value="<?= htmlspecialchars($_POST['yetiskin_2'] ?? '') ?>">
      <input type="text" name="yetiskin_3" class="field" placeholder="3. Yetişkin Ad Soyad" maxlength="24" style="display:none"
             value="<?= htmlspecialchars($_POST['yetiskin_3'] ?? '') ?>">
      <input type="text" name="yetiskin_4" class="field" placeholder="4. Yetişkin Ad Soyad" maxlength="24" style="display:none"
             value="<?= htmlspecialchars($_POST['yetiskin_4'] ?? '') ?>">
      <input type="text" name="yetiskin_5" class="field" placeholder="5. Yetişkin Ad Soyad" maxlength="24" style="display:none"
             value="<?= htmlspecialchars($_POST['yetiskin_5'] ?? '') ?>">
    </div>

    <!-- Çocuk Stepper -->
    <div class="stepper" data-min="0" data-max="5" data-target="">
      <span class="stepper-label">Çocuk <span>(0–5)</span></span>
      <div class="stepper-controls">
        <button type="button" class="stepper-btn" disabled aria-label="Azalt">−</button>
        <span class="stepper-value">0</span>
        <button type="button" class="stepper-btn" aria-label="Arttır">+</button>
      </div>
    </div>
    <input type="hidden" name="cocuk_sayisi" value="0" id="h_cocuk_sayisi">
    <p style="font-size:.75rem;color:var(--body-muted);margin-top:.25rem">Çocuk yaşları, doğru fiyatlandırma için doğum tarihinden hesaplanır.</p>
  </div>

  <!-- ===== İLETİŞİM ===== -->
  <div class="field-group">
    <div class="field-label" style="margin-bottom:.75rem">
      <span style="display:inline-flex;align-items:center;gap:.5rem">
        <span style="display:inline-block;width:1.5rem;height:1px;background:var(--gold-dim)"></span>
        İletişim Bilgileri
      </span>
    </div>
    <div class="field-row">
      <div>
        <label class="field-label" for="email">E-posta</label>
        <input type="email" id="email" name="email" class="field" placeholder="ornek@eposta.com"
               value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
      </div>
      <div>
        <label class="field-label" for="telefon">Telefon</label>
        <input type="tel" id="telefon" name="telefon" class="field" placeholder="+90 5xx xxx xx xx"
               value="<?= htmlspecialchars($_POST['telefon'] ?? '') ?>">
      </div>
    </div>
    <p style="font-size:.75rem;color:var(--body-muted);margin-top:.25rem">E-posta veya telefon alanından en az birini doldurunuz.</p>
  </div>

  <!-- ===== NOT ===== -->
  <div class="field-group">
    <label class="field-label" for="not">Özel İstek / Not</label>
    <textarea id="not" name="not" rows="4" maxlength="600" class="field" placeholder="Bizimle paylaşmak istediğiniz özel istekleriniz..."><?= htmlspecialchars($_POST['not'] ?? '') ?></textarea>
  </div>

  <!-- ===== SUBMIT ===== -->
  <button type="submit" class="btn-primary">Rezervasyon Talebi Gönder</button>

  <p style="text-align:center;font-size:.75rem;color:var(--body-muted);margin-top:.75rem">
    Talebinizi göndererek
    <a href="hakkimizda/index.html" style="color:var(--gold);text-decoration:underline;text-underline-offset:2px">KVKK Aydınlatma Metni</a>'ni
    okuduğunuzu kabul edersiniz.
  </p>

</form>
