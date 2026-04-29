<?php
// ============================================================
//  db_config.php — Database connection (PDO)
// ============================================================

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'social_media_analytics');
define('DB_USER', 'root');          // change to your MySQL user
define('DB_PASS', '');              // change to your MySQL password
define('DB_CHARSET', 'utf8mb4');

function getDBConnection(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}

// JSON response helper
function jsonResponse(bool $success, $data = null, string $message = ''): void {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $success,
        'data'    => $data,
        'message' => $message,
    ]);
    exit;
}

// Sanitize input
function sanitize(string $input): string {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}