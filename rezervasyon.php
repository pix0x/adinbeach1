<?php
// ============================================================
// Adin Beach Hotel - Rezervasyon Formu + Telegram & WhatsApp
// ============================================================

// --- Config oku (admin panelden yönetilir) ---
$configFile = __DIR__ . '/admin/config.json';
$config = [];
if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true);
}
$botToken = $config['telegram_bot_token'] ?? '8534376935:AAHQQ3hjRTm03v05Rvv9KCF2okKnw5nYRg4';
$chatId   = $config['telegram_chat_id'] ?? '-5137488261';
$whatsappNumber = $config['whatsapp_number'] ?? '905452355493';
$whatsappApiKey = $config['whatsapp_api_key'] ?? '';
$whatsappEnabled = !empty($config['whatsapp_enabled']) && !empty($whatsappApiKey);

$success = null;
$error   = null;

// --- Log dosyası ---
$logFile = __DIR__ . '/rezervasyonlar.json';

// --- Form gönderildi mi? ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $giris   = trim($_POST['giris'] ?? '');
    $cikis   = trim($_POST['cikis'] ?? '');
    $odaTipi = trim($_POST['oda_tipi'] ?? '');
    $email   = trim($_POST['email'] ?? '');
    $telefon = trim($_POST['telefon'] ?? '');
    $notlar  = trim($_POST['not'] ?? '');
    $yetiskinSayisi = (int)($_POST['yetiskin_sayisi'] ?? 2);
    $cocukSayisi    = (int)($_POST['cocuk_sayisi'] ?? 0);

    // validation
    $errors = [];
    if (!$giris) $errors[] = 'Giriş tarihi zorunludur.';
    if (!$cikis) $errors[] = 'Çıkış tarihi zorunludur.';
    if (!$odaTipi) $errors[] = 'Oda tipi seçiniz.';
    if (!$email && !$telefon) $errors[] = 'E-posta veya telefon alanından en az birini doldurun.';

    if ($errors) {
        $error = implode('<br>', $errors);
    } else {
        // --- Rezervasyon kaydı ---
        $kayit = [
            'tarih'  => date('Y-m-d H:i:s'),
            'giris'  => $giris,
            'cikis'  => $cikis,
            'oda_tipi' => $odaTipi,
            'yetiskin' => $yetiskinSayisi,
            'cocuk'    => $cocukSayisi,
            'email'    => $email,
            'telefon'  => $telefon,
            'not'      => $notlar,
        ];

        // JSON log dosyasına kaydet
        $rezervasyonlar = [];
        if (file_exists($logFile)) {
            $rezervasyonlar = json_decode(file_get_contents($logFile), true) ?? [];
        }
        $rezervasyonlar[] = $kayit;
        file_put_contents($logFile, json_encode($rezervasyonlar, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // --- Telegram mesajını oluştur ---
        $msg = "<b>🛎 YENİ REZERVASYON TALEBİ</b>\n\n";
        $msg .= "<b>📅 Giriş:</b> $giris\n";
        $msg .= "<b>📅 Çıkış:</b> $cikis\n";
        $msg .= "<b>🏠 Oda Tipi:</b> $odaTipi\n";
        $msg .= "<b>👤 Yetişkin:</b> $yetiskinSayisi\n";
        $msg .= "<b>🧒 Çocuk:</b> $cocukSayisi\n";

        // misafir adları
        $misafirler = [];
        for ($i = 1; $i <= max($yetiskinSayisi, 2); $i++) {
            $ad = trim($_POST["yetiskin_$i"] ?? '');
            if ($ad) $misafirler[] = "• $ad";
        }
        if ($misafirler) {
            $msg .= "\n<b>👥 Misafirler:</b>\n" . implode("\n", $misafirler) . "\n";
        }

        $msg .= "\n<b>📞 İletişim:</b>\n";
        if ($email)   $msg .= "• E-posta: $email\n";
        if ($telefon) $msg .= "• Telefon: $telefon\n";

        if ($notlar) {
            $msg .= "\n<b>📝 Not:</b>\n$notlar\n";
        }

        $msg .= "\n⏱ " . date('d.m.Y H:i:s');

        // --- Telegram API'ye gönder ---
        $telegramOk = false;
        $postData = json_encode([
            'chat_id'    => $chatId,
            'text'       => $msg,
            'parse_mode' => 'HTML',
        ]);

        $ch = curl_init('https://api.telegram.org/bot' . $botToken . '/sendMessage');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $postData,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
        ]);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $telegramOk = true;
        }

        // --- WhatsApp bildirimi (CallMeBot) ---
        $whatsappOk = false;
        if ($whatsappEnabled) {
            $waMsg = "🛎 YENİ REZERVASYON TALEBİ%0A%0A";
            $waMsg .= "Giriş: $giris%0A";
            $waMsg .= "Çıkış: $cikis%0A";
            $waMsg .= "Oda: $odaTipi%0A";
            $waMsg .= "Yetişkin: $yetiskinSayisi%0A";
            if ($cocukSayisi > 0) $waMsg .= "Çocuk: $cocukSayisi%0A";
            if ($misafirler) $waMsg .= "Misafirler: " . implode(", ", $misafirler) . "%0A";
            if ($email) $waMsg .= "E-posta: $email%0A";
            if ($telefon) $waMsg .= "Telefon: $telefon%0A";
            if ($notlar) $waMsg .= "Not: $notlar%0A";
            $waMsg .= "Tarih: " . date('d.m.Y H:i:s');

            $waUrl = "https://api.callmebot.com/whatsapp.php?phone=$whatsappNumber&text=$waMsg&apikey=$whatsappApiKey";

            $ch = curl_init($waUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 10,
            ]);
            $waResp = curl_exec($ch);
            $waHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($waHttp === 200) {
                $whatsappOk = true;
            }
        }

        // --- Sonuç ---
        if ($telegramOk) {
            $success = 'Rezervasyon talebiniz başarıyla alındı! En kısa sürede sizinle iletişime geçeceğiz.';
        } else {
            $error = 'Bir hata oluştu, lütfen daha sonra tekrar deneyiniz.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rezervasyon — Adin Beach Hotel</title>
<meta name="theme-color" content="#bb9b6a">
<link rel="icon" type="image/png" href="images/brand/favIcon.png">

<link rel="stylesheet" href="assets/css/google-fonts.css">
<style>
/* ===== RESET & BASE ===== */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:'Montserrat',system-ui,sans-serif;
  background:#111110;
  color:#e7e1d6;
  min-height:100vh;
  display:flex;
  flex-direction:column;
}

/* ===== COLORS ===== */
:root{
  --gold:#bb9b6a;
  --gold-dim:#8a7450;
  --ink:#1c1c1a;
  --body:#e7e1d6;
  --body-muted:#a09888;
}

/* ===== HEADER / NAV ===== */
.site-header{
  position:fixed;inset:0 0 auto 0;z-index:50;
  background:linear-gradient(180deg,rgba(0,0,0,.55),transparent);
  padding:.75rem 1.5rem;
  display:flex;align-items:center;justify-content:space-between;
}
.site-header .logo{height:2.5rem}
.main-nav{display:flex;align-items:center;gap:1.5rem}
.main-nav a{
  color:rgba(255,255,255,.85);text-decoration:none;
  font-size:.78rem;font-weight:500;letter-spacing:.06em;
  text-transform:uppercase;transition:color .2s;
  white-space:nowrap;
}
.main-nav a:hover{color:var(--gold)}
.main-nav .nav-cta{
  background:var(--gold);color:var(--ink);padding:.5rem 1.25rem;
  border-radius:.375rem;font-weight:600;font-size:.72rem;
  transition:background .3s,transform .2s;
}
.main-nav .nav-cta:hover{background:#c9a977;color:var(--ink);transform:translateY(-1px)}
@media(max-width:900px){.main-nav{display:none}}
.top-bar{
  background:#1a1a18;
  border-bottom:1px solid rgba(255,255,255,.08);
  padding:.5rem 1.5rem;
  display:flex;align-items:center;justify-content:space-between;
  font-size:.75rem;color:rgba(255,255,255,.85);
}
.top-bar a{color:inherit;text-decoration:none;transition:color .2s}
.top-bar a:hover{color:#fff}
.top-bar .phone{display:inline-flex;align-items:center;gap:.5rem}
.top-bar .social{display:flex;align-items:center;gap:.75rem}
.top-bar .social svg{width:1rem;height:1rem;fill:currentColor}

/* ===== HERO ===== */
.hero{
  position:relative;height:40vh;min-height:280px;
  display:flex;align-items:center;justify-content:center;
  text-align:center;
}
.hero-bg{
  position:absolute;inset:0;z-index:0;
  background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.65)),url('assets/images/home/reservation-cta.jpg') center/cover no-repeat;
}
.hero-content{position:relative;z-index:1;padding:1.5rem}
.hero h1{
  font-family:'Cormorant Garamond',serif;
  font-weight:500;font-size:clamp(2rem,5vw,3.5rem);
  color:#fff;margin-bottom:.5rem;
}
.hero p{color:var(--body-muted);font-size:.9rem;letter-spacing:.04em}
.hero .gold-line{
  width:3rem;height:2px;background:var(--gold);
  margin:.75rem auto 0;
}

/* ===== FORM CARD ===== */
.form-section{padding:2rem 1rem 4rem;flex:1}
.form-card{
  max-width:720px;margin:0 auto;
  background:#1a1a18;border-radius:1rem;
  padding:2rem;
  border:1px solid rgba(255,255,255,.06);
}
.form-card h2{
  font-family:'Cormorant Garamond',serif;
  font-weight:500;font-size:1.5rem;color:#fff;
  margin-bottom:.25rem;
}
.form-card .form-subtitle{
  font-size:.8rem;color:var(--body-muted);
  margin-bottom:1.75rem;
}

/* ===== FIELDS ===== */
.field-group{margin-bottom:1.25rem}
.field-label{
  display:block;font-size:.72rem;font-weight:600;
  letter-spacing:.08em;text-transform:uppercase;
  color:var(--gold);margin-bottom:.4rem;
}
.field{
  width:100%;padding:.7rem .85rem;
  background:#22211e;border:1px solid rgba(255,255,255,.08);
  border-radius:.5rem;color:var(--body);font-size:.875rem;
  font-family:'Montserrat',system-ui,sans-serif;
  transition:border-color .2s,box-shadow .2s;
  outline:none;
}
.field:focus{border-color:var(--gold);box-shadow:0 0 0 2px rgba(187,155,106,.15)}
.field::placeholder{color:var(--body-muted);opacity:.6}
select.field option{background:#1a1a18;color:var(--body)}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media(max-width:480px){.field-row{grid-template-columns:1fr}}

/* stepper */
.stepper{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:.5rem;
}
.stepper-label{font-size:.8rem;color:var(--body)}
.stepper-label span{color:var(--body-muted);font-size:.75rem}
.stepper-controls{display:flex;align-items:center;gap:.5rem}
.stepper-btn{
  width:2.25rem;height:2.25rem;
  display:flex;align-items:center;justify-content:center;
  background:transparent;border:1px solid rgba(231,225,214,.15);
  border-radius:.375rem;color:var(--body);
  font-size:1.1rem;cursor:pointer;transition:all .2s;
}
.stepper-btn:hover{border-color:var(--gold);color:var(--gold)}
.stepper-btn:disabled{opacity:.3;cursor:not-allowed}
.stepper-value{
  width:1.75rem;text-align:center;
  font-weight:600;font-size:1rem;color:#fff;
}
.guest-inputs{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.5rem}
@media(max-width:480px){.guest-inputs{grid-template-columns:1fr}}

/* ===== BUTTON ===== */
.btn-primary{
  width:100%;padding:.9rem 2rem;
  background:var(--gold);color:var(--ink);
  border:none;border-radius:.5rem;
  font-family:'Montserrat',system-ui,sans-serif;
  font-weight:600;font-size:.85rem;
  letter-spacing:.08em;text-transform:uppercase;
  cursor:pointer;transition:all .3s;
}
.btn-primary:hover{background:#c9a977;transform:translateY(-1px)}
.btn-primary:active{transform:translateY(0)}

/* ===== NOTIFICATIONS ===== */
.notification{
  padding:1rem 1.25rem;border-radius:.5rem;
  margin-bottom:1.5rem;font-size:.875rem;line-height:1.5;
}
.notification.success{
  background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25);
  color:#86efac;
}
.notification.error{
  background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);
  color:#fca5a5;
}

/* ===== FOOTER ===== */
.site-footer{
  background:#111110;border-top:1px solid rgba(255,255,255,.06);
  padding:2rem 1.5rem;text-align:center;
  font-size:.75rem;color:var(--body-muted);
  margin-top:auto;
}

/* ===== SUCCESS PAGE ===== */
.success-page{text-align:center;padding:3rem 1rem}
.success-page .icon{font-size:4rem;margin-bottom:1rem}
.success-page h2{font-family:'Cormorant Garamond',serif;font-size:2rem;color:#fff;margin-bottom:.75rem}
.success-page p{color:var(--body-muted);max-width:400px;margin:0 auto 1.5rem;font-size:.9rem}
.success-page .btn-back{
  display:inline-flex;align-items:center;gap:.5rem;
  color:var(--gold);text-decoration:none;
  font-size:.85rem;font-weight:600;
  transition:color .2s;
}
.success-page .btn-back:hover{color:#c9a977}
</style>
</head>
<body>

<!-- ===== TOP BAR ===== -->
<div class="top-bar">
  <a href="tel:<?= htmlspecialchars(preg_replace('/[^0-9+]/', '', $config['phone'] ?? '+902424394918')) ?>" class="phone">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:.85rem;height:.85rem"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>
    <?= htmlspecialchars($config['phone'] ?? '+90 242 439 49 18') ?>
  </a>
  <div class="social">
    <a href="https://wa.me/<?= htmlspecialchars($config['whatsapp_number'] ?? '905452355493') ?>" target="_blank" aria-label="WhatsApp">
      <svg viewBox="0 0 24 24"><path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.1L2 22l5.05-1.32A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.13 15.06l-.3-.18-3 .78.8-2.92-.2-.31A8.1 8.1 0 0 1 12.04 3.8z"/></svg>
    </a>
    <a href="https://www.instagram.com/adinhotel/" target="_blank" aria-label="Instagram">
      <svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.3-1.7 4.8-4.9 4.9-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8C2.3 3.9 3.9 2.3 7.2 2.2 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.9.3.3 2.9.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.2 2.8 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.2-.2 6.8-2.8 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.2-2.8-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.5a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9z"/></svg>
    </a>
  </div>
</div>

<!-- ===== HEADER ===== -->
<header class="site-header">
  <a href="index.html"><img src="assets/images/brand/logo-white.png" alt="Adin Beach Hotel" class="logo"></a>
  <nav class="main-nav">
    <a href="/odalar/">Odalar</a>
    <a href="/lezzet/">Lezzet</a>
    <a href="/deniz-ve-havuz/">Deniz &amp; Havuz</a>
    <a href="/eglence/">Eğlence</a>
    <a href="/toplanti/">Toplantı</a>
    <a href="/hakkimizda/">Hakkımızda</a>
    <a href="/bize-ulasin/">İletişim</a>
    <a href="/rezervasyon/" class="nav-cta">Rezervasyon</a>
  </nav>
</header>

<!-- ===== HERO ===== -->
<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <h1>Rezervasyon Talebi</h1>
    <p>Size özel teklifimizi hazırlamamız için bilgilerinizi doldurun</p>
    <div class="gold-line"></div>
  </div>
</section>

<!-- ===== FORM SECTION ===== -->
<section class="form-section">
  <div class="form-card">

<?php if ($success): ?>
    <!-- BAŞARILI -->
    <div class="success-page">
      <div class="icon">✅</div>
      <h2>Teşekkür Ederiz!</h2>
      <p><?= htmlspecialchars($success) ?></p>
      <a href="index.html" class="btn-back">← Ana Sayfaya Dön</a>
    </div>

<?php elseif ($error): ?>
    <!-- HATA -->
    <div class="notification error"><?= $error ?></div>
    <?php include '_form_template.php'; ?>

<?php else: ?>
    <!-- FORM -->
    <?php include '_form_template.php'; ?>
<?php endif; ?>

  </div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="site-footer">
  Adin Beach Hotel &copy; <?= date('Y') ?> &mdash; Tüm hakları saklıdır.
</footer>

<script>
document.querySelectorAll('.stepper').forEach(function(stepper) {
  var display = stepper.querySelector('.stepper-value');
  var btnMinus = stepper.querySelector('.stepper-btn:first-child');
  var btnPlus = stepper.querySelector('.stepper-btn:last-child');
  var min = parseInt(stepper.dataset.min || 1);
  var max = parseInt(stepper.dataset.max || 5);
  var targetName = stepper.dataset.target || '';

  // hidden input = stepper'den sonraki kardeş element (input[type=hidden])
  var hiddenInput = stepper.parentNode.querySelector('input[type=hidden]');
  if (!hiddenInput) hiddenInput = stepper.nextElementSibling;

  function update(val) {
    if (val < min) val = min;
    if (val > max) val = max;
    display.textContent = val;
    btnMinus.disabled = val <= min;
    if (hiddenInput) hiddenInput.value = val;

    if (targetName) {
      var container = document.getElementById('guest_' + targetName);
      if (container) {
        var inputs = container.querySelectorAll('input');
        for (var i = 0; i < inputs.length; i++) {
          inputs[i].style.display = i < val ? '' : 'none';
        }
      }
    }
  }

  btnPlus.addEventListener('click', function() { update(parseInt(display.textContent) + 1); });
  btnMinus.addEventListener('click', function() { update(parseInt(display.textContent) - 1); });
});
</script>
</body>
</html>
