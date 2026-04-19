<?php

ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

function loadEnv($path) {
    if (!file_exists($path)) return [];
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $env = [];
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $env[trim($key)] = trim($value);
        }
    }
    return $env;
}

$env = loadEnv(__DIR__ . '/.env');
$apiUrl = $env['API_URL'] ?? '';

if (empty($apiUrl)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'API_URL not configured in .env file']);
    exit;
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Content-Type: application/json; charset=utf-8');

$cacheFile = __DIR__ . '/cache/api-cache.json';
$cacheTime = 30; // seconds

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
    readfile($cacheFile);
    exit;
}

$response = false;
$error = null;

if (function_exists('curl_init')) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'IIM-Proxy/1.0',
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($error || $httpCode !== 200) {
        $response = false;
        $error = $error ?: "HTTP $httpCode";
    }
} else {
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'user_agent' => 'IIM-Proxy/1.0',
            'follow_location' => 1
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]
    ]);
    $response = @file_get_contents($apiUrl, false, $context);
    if ($response === false) {
        $error = error_get_last()['message'] ?? 'Unknown error';
    }
}

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Upstream API unavailable', 'details' => $error]);
    exit;
}

$decoded = json_decode($response);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(502);
    echo json_encode(['error' => 'Invalid JSON received from upstream']);
    exit;
}

if (!is_dir(dirname($cacheFile))) {
    mkdir(dirname($cacheFile), 0755, true);
}
file_put_contents($cacheFile, $response);
echo $response;