<?php
header('Content-Type: application/json');

$configFile = __DIR__ . '/config.json';
if (!file_exists($configFile)) {
    echo json_encode(['ok' => false, 'error' => 'config.json bulunamadı']);
    exit;
}

$config = json_decode(file_get_contents($configFile), true);
$botToken = $config['telegram_bot_token'] ?? '';
$chatId   = $config['telegram_chat_id'] ?? '';

if (!$botToken || !$chatId) {
    echo json_encode(['ok' => false, 'error' => 'Bot token veya chat ID tanımlı değil']);
    exit;
}

$msg = "<b>✅ Test Mesajı</b>\n\nAdmin panel test mesajı başarıyla ulaştı!\n\n⏱ " . date('d.m.Y H:i:s');

$ch = curl_init('https://api.telegram.org/bot' . $botToken . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode([
        'chat_id'    => $chatId,
        'text'       => $msg,
        'parse_mode' => 'HTML',
    ]),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);
$resp = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    echo json_encode(['ok' => true, 'error' => null]);
} else {
    echo json_encode(['ok' => false, 'error' => "HTTP $httpCode: $resp"]);
}
