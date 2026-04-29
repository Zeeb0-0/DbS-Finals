<?php
// ============================================================
//  run_script.php — Execute Python backend scripts via PHP
// ============================================================
require_once __DIR__ . '/db_config.php';

header('Content-Type: application/json');

$allowed_scripts = [
    'sentiment'   => '../python/sentiment_analysis.py',
    'aggregate'   => '../python/data_aggregation.py',
    'trend'       => '../python/trend_analysis.py',
];

$script_key = sanitize($_POST['script'] ?? $_GET['script'] ?? '');
$post_id    = (int)($_POST['post_id'] ?? $_GET['post_id'] ?? 0);
$user_id    = (int)($_POST['user_id'] ?? $_GET['user_id'] ?? 0);

if (!array_key_exists($script_key, $allowed_scripts)) {
    jsonResponse(false, null, "Unknown script: '$script_key'");
}

$script_path = realpath(__DIR__ . '/' . $allowed_scripts[$script_key]);
if (!$script_path || !file_exists($script_path)) {
    jsonResponse(false, null, "Script file not found: $script_key");
}

$allowed_base = realpath(__DIR__ . '/../python');
if (!$script_path || strpos($script_path, $allowed_base) !== 0) {
    jsonResponse(false, null, 'Script path rejected');
}

// Build argument list safely
$args = [];
if ($post_id > 0) $args[] = '--post_id ' . escapeshellarg($post_id);
if ($user_id > 0) $args[] = '--user_id ' . escapeshellarg($user_id);

$cmd     = 'python3 ' . escapeshellarg($script_path) . ' ' . implode(' ', $args) . ' 2>&1';
$output  = shell_exec($cmd);
$decoded = json_decode($output, true);

if ($decoded !== null) {
    jsonResponse(true, $decoded, "$script_key completed");
} else {
    jsonResponse(false, ['raw_output' => $output], 'Script returned non-JSON output');
}