<?php
session_start();
$configFile = __DIR__ . '/config.json';
$logFile = __DIR__ . '/../rezervasyonlar.json';

$config = json_decode(file_get_contents($configFile), true);

// LOGOUT
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// LOGIN
$loggedIn = !empty($_SESSION['admin_logged']);

if (!$loggedIn && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    if ($_POST['password'] === $config['admin_password']) {
        $_SESSION['admin_logged'] = true;
        $loggedIn = true;
    } else {
        $loginError = 'Hatalı şifre!';
    }
}

// SAVE SETTINGS
if ($loggedIn && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_settings'])) {
    $config['phone'] = $_POST['phone'] ?? $config['phone'];
    $config['whatsapp_number'] = $_POST['whatsapp_number'] ?? $config['whatsapp_number'];
    $config['telegram_bot_token'] = $_POST['telegram_bot_token'] ?? $config['telegram_bot_token'];
    $config['telegram_chat_id'] = $_POST['telegram_chat_id'] ?? $config['telegram_chat_id'];
    $config['whatsapp_api_key'] = $_POST['whatsapp_api_key'] ?? $config['whatsapp_api_key'];
    $config['whatsapp_enabled'] = isset($_POST['whatsapp_enabled']);
    $config['site_name'] = $_POST['site_name'] ?? $config['site_name'];
    if (!empty($_POST['new_password'])) {
        $config['admin_password'] = $_POST['new_password'];
    }
    file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    $saveSuccess = 'Ayarlar kaydedildi!';
}

// READ RESERVATIONS
$reservations = [];
if (file_exists($logFile)) {
    $reservations = json_decode(file_get_contents($logFile), true) ?? [];
}
$reservations = array_reverse($reservations); // newest first
?>
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin Panel — <?= htmlspecialchars($config['site_name']) ?></title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#f5f3ef;color:#1c1c1a;min-height:100vh}
.admin-header{background:#1c1c1a;color:#e7e1d6;padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between}
.admin-header h1{font-size:1.1rem;font-weight:600}
.admin-header a{color:var(--gold,#bb9b6a);text-decoration:none;font-size:.85rem}
.admin-header .gold{color:#bb9b6a}
.container{max-width:960px;margin:2rem auto;padding:0 1rem}
.card{background:#fff;border-radius:.75rem;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h2{font-size:1.1rem;font-weight:600;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid #eee;display:flex;align-items:center;gap:.5rem}
.form-group{margin-bottom:1rem}
.form-group label{display:block;font-size:.8rem;font-weight:600;color:#555;margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.04em}
.form-group input[type=text],.form-group input[type=password],.form-group input[type=tel]{width:100%;padding:.6rem .75rem;border:1px solid #ddd;border-radius:.375rem;font-size:.9rem;outline:none;transition:border-color .2s}
.form-group input:focus{border-color:#bb9b6a;box-shadow:0 0 0 2px rgba(187,155,106,.15)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media(max-width:600px){.form-row{grid-template-columns:1fr}}
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.6rem 1.25rem;border:none;border-radius:.375rem;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s}
.btn-primary{background:#bb9b6a;color:#1c1c1a}.btn-primary:hover{background:#c9a977}
.btn-danger{background:#dc2626;color:#fff}.btn-danger:hover{background:#b91c1c}
.btn-sm{padding:.4rem .75rem;font-size:.8rem}
.alert{padding:.75rem 1rem;border-radius:.375rem;margin-bottom:1rem;font-size:.875rem}
.alert-success{background:#dcfce7;color:#166534;border:1px solid #86efac}
.alert-error{background:#fce4ec;color:#991b1b;border:1px solid #fca5a5}
.tabs{display:flex;gap:0;margin-bottom:1.5rem;border-bottom:1px solid #ddd}
.tab{padding:.6rem 1.25rem;cursor:pointer;font-size:.85rem;font-weight:500;color:#666;border-bottom:2px solid transparent;text-decoration:none;transition:all .2s}
.tab:hover{color:#333}
.tab.active{color:#bb9b6a;border-bottom-color:#bb9b6a}

/* Reservation table */
table{width:100%;border-collapse:collapse;font-size:.85rem}
th,td{padding:.6rem .75rem;text-align:left;border-bottom:1px solid #eee}
th{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#888;font-weight:600}
tr:hover td{background:#faf8f5}
.badge{padding:.2rem .5rem;border-radius:999px;font-size:.7rem;font-weight:600}
.badge-new{background:#dcfce7;color:#166534}
.badge-read{background:#f3f4f6;color:#6b7280}
.empty{text-align:center;padding:2rem;color:#999;font-size:.9rem}
.login-box{max-width:360px;margin:4rem auto;padding:2rem;background:#fff;border-radius:.75rem;box-shadow:0 4px 12px rgba(0,0,0,.1)}
.login-box h2{text-align:center;margin-bottom:.5rem;color:#1c1c1a}
.login-box p{text-align:center;font-size:.85rem;color:#888;margin-bottom:1.5rem}
.login-box input[type=password]{width:100%;padding:.75rem;border:1px solid #ddd;border-radius:.375rem;font-size:1rem;outline:none}
.login-box input:focus{border-color:#bb9b6a}
.login-box .btn{width:100%;justify-content:center;margin-top:1rem;padding:.75rem}
.login-error{background:#fce4ec;color:#991b1b;padding:.5rem;border-radius:.375rem;font-size:.85rem;text-align:center;margin-bottom:1rem}
.copy-btn{background:none;border:1px solid #ddd;border-radius:.25rem;padding:.15rem .4rem;font-size:.7rem;cursor:pointer;color:#888;transition:all .2s}
.copy-btn:hover{background:#f0f0f0;color:#333}
.footer{text-align:center;padding:1.5rem;font-size:.75rem;color:#999}
</style>
</head>
<body>

<?php if ($loggedIn): ?>

<!-- ===== ADMIN HEADER ===== -->
<div class="admin-header">
  <h1>⚙️ <span class="gold"><?= htmlspecialchars($config['site_name']) ?></span> Admin</h1>
  <div style="display:flex;align-items:center;gap:1rem">
    <a href="?tab=settings" class="<?= (!isset($_GET['tab']) || $_GET['tab'] === 'settings') ? 'gold' : '' ?>">Ayarlar</a>
    <a href="?tab=reservations" class="<?= ($_GET['tab'] ?? '') === 'reservations' ? 'gold' : '' ?>">Rezervasyonlar</a>
    <a href="?logout=1">Çıkış</a>
  </div>
</div>

<div class="container">
  <?php if (isset($saveSuccess)): ?>
    <div class="alert alert-success"><?= $saveSuccess ?></div>
  <?php endif; ?>

  <div class="tabs">
    <a href="?tab=settings" class="tab <?= (!isset($_GET['tab']) || $_GET['tab'] === 'settings') ? 'active' : '' ?>">Ayarlar</a>
    <a href="?tab=reservations" class="tab <?= ($_GET['tab'] ?? '') === 'reservations' ? 'active' : '' ?>">Rezervasyonlar (<?= count($reservations) ?>)</a>
  </div>

  <!-- ===== SETTINGS TAB ===== -->
  <?php if (!isset($_GET['tab']) || $_GET['tab'] === 'settings'): ?>
  <div class="card">
    <h2>📞 İletişim Numaraları</h2>
    <form method="POST">
      <div class="form-row">
        <div class="form-group">
          <label>Telefon Numarası</label>
          <input type="tel" name="phone" value="<?= htmlspecialchars($config['phone']) ?>">
        </div>
        <div class="form-group">
          <label>WhatsApp Numarası (başında + olmadan)</label>
          <input type="tel" name="whatsapp_number" value="<?= htmlspecialchars($config['whatsapp_number']) ?>">
        </div>
      </div>
  </div>

  <div class="card">
    <h2>🤖 Telegram Bot</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Bot Token</label>
          <input type="text" name="telegram_bot_token" value="<?= htmlspecialchars($config['telegram_bot_token']) ?>">
        </div>
        <div class="form-group">
          <label>Chat ID</label>
          <input type="text" name="telegram_chat_id" value="<?= htmlspecialchars($config['telegram_chat_id']) ?>">
        </div>
      </div>
  </div>

  <div class="card">
    <h2>💬 WhatsApp Bildirimi</h2>
      <div class="form-row">
        <div class="form-group">
          <label>WhatsApp API Key (CallMeBot)</label>
          <input type="text" name="whatsapp_api_key" value="<?= htmlspecialchars($config['whatsapp_api_key'] ?? '') ?>" placeholder="Boş bırakılırsa WhatsApp bildirimi kapalı">
          <div style="font-size:.75rem;color:#888;margin-top:.3rem">
            CallMeBot kullanmak için: WhatsApp'ta <strong>+34 611 01 16 37</strong>'ye "I allow callmebot to call me" yazın, 
            size gelen API key'i girin.
          </div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:.5rem;padding-top:1.5rem">
          <input type="checkbox" name="whatsapp_enabled" id="we" <?= !empty($config['whatsapp_enabled']) ? 'checked' : '' ?> style="width:1.1rem;height:1.1rem">
          <label for="we" style="margin:0">WhatsApp bildirimi aktif</label>
        </div>
      </div>
  </div>

  <div class="card">
    <h2>🔒 Site Ayarları</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Site Adı</label>
          <input type="text" name="site_name" value="<?= htmlspecialchars($config['site_name'] ?? 'Adin Beach Hotel') ?>">
        </div>
        <div class="form-group">
          <label>Yeni Admin Şifresi (boş bırakılırsa değişmez)</label>
          <input type="password" name="new_password" placeholder="Yeni şifre girin">
        </div>
      </div>
      <div style="margin-top:1rem">
        <button type="submit" name="save_settings" class="btn btn-primary">💾 Kaydet</button>
      </div>
    </form>
  </div>

  <!-- Quick test -->
  <div class="card">
    <h2>🧪 Hızlı Test</h2>
    <p style="font-size:.85rem;color:#666;margin-bottom:.75rem">Telegram botunu test et:</p>
    <button onclick="testTelegram()" class="btn btn-primary btn-sm">📨 Test Mesajı Gönder</button>
    <span id="testResult" style="font-size:.85rem;margin-left:.75rem"></span>
    <script>
    function testTelegram() {
      document.getElementById('testResult').textContent = 'Gönderiliyor...';
      fetch('../admin/test_telegram.php').then(r=>r.json()).then(d=>{
        document.getElementById('testResult').textContent = d.ok ? '✅ Başarılı' : '❌ Hata: ' + d.error;
      }).catch(e=>{
        document.getElementById('testResult').textContent = '❌ Hata';
      });
    }
    </script>
  </div>
  <?php endif; ?>

  <!-- ===== RESERVATIONS TAB ===== -->
  <?php if (($_GET['tab'] ?? '') === 'reservations'): ?>
  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:1rem 1.25rem;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between">
      <h2 style="margin:0;border:none;padding:0">📋 Rezervasyonlar</h2>
      <span style="font-size:.8rem;color:#888">Toplam: <?= count($reservations) ?></span>
    </div>
    <?php if (empty($reservations)): ?>
      <div class="empty">Henüz rezervasyon kaydı yok.</div>
    <?php else: ?>
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>Tarih</th>
          <th>Oda</th>
          <th>Giriş</th>
          <th>Çıkış</th>
          <th>Kişi</th>
          <th>İletişim</th>
          <th>Not</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($reservations as $r): ?>
        <tr>
          <td style="white-space:nowrap;font-size:.75rem"><?= htmlspecialchars($r['tarih'] ?? '') ?></td>
          <td><strong><?= htmlspecialchars($r['oda_tipi'] ?? '') ?></strong></td>
          <td style="white-space:nowrap"><?= htmlspecialchars($r['giris'] ?? '') ?></td>
          <td style="white-space:nowrap"><?= htmlspecialchars($r['cikis'] ?? '') ?></td>
          <td>
            <span class="badge badge-new"><?= htmlspecialchars($r['yetiskin'] ?? '0') ?> yetişkin</span>
            <?php if (!empty($r['cocuk']) && $r['cocuk'] > 0): ?>
              <span class="badge badge-read"><?= $r['cocuk'] ?> çocuk</span>
            <?php endif; ?>
          </td>
          <td style="font-size:.8rem">
            <?php if (!empty($r['email'])): ?>
              <div>📧 <?= htmlspecialchars($r['email']) ?></div>
            <?php endif; ?>
            <?php if (!empty($r['telefon'])): ?>
              <div>📞 <?= htmlspecialchars($r['telefon']) ?></div>
            <?php endif; ?>
          </td>
          <td style="font-size:.75rem;color:#888;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><?= htmlspecialchars($r['not'] ?? '-') ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <?php endif; ?>
  </div>
  <?php endif; ?>
</div>

<?php else: ?>
<!-- ===== LOGIN ===== -->
<div class="login-box">
  <h2>🔐 Admin Paneli</h2>
  <p><?= htmlspecialchars($config['site_name']) ?></p>
  <?php if (isset($loginError)): ?>
    <div class="login-error"><?= $loginError ?></div>
  <?php endif; ?>
  <form method="POST">
    <input type="password" name="password" placeholder="Admin şifresi" autofocus>
    <button type="submit" name="login" class="btn btn-primary">Giriş</button>
  </form>
</div>
<?php endif; ?>

<div class="footer">
  <a href="/adinbeach/" style="color:#bb9b6a;text-decoration:none">← Siteye Dön</a>
</div>
</body>
</html>
