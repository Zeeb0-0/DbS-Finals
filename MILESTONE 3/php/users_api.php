<?php
// ============================================================
//  users_api.php — CRUD for tracked social-media accounts
// ============================================================
require_once __DIR__ . '/db_config.php';

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];
$pdo    = getDBConnection();

switch ($method) {
    case 'GET':
        $id = (int)($_GET['id'] ?? 0);
        if ($id > 0) {
            $stmt = $pdo->prepare("SELECT u.*, pl.platform_name FROM users u JOIN platforms pl ON u.platform_id=pl.platform_id WHERE u.user_id=?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            $row ? jsonResponse(true, $row) : jsonResponse(false, null, 'User not found');
        } else {
            $stmt = $pdo->query("SELECT u.*, pl.platform_name FROM users u JOIN platforms pl ON u.platform_id=pl.platform_id ORDER BY u.followers DESC");
            jsonResponse(true, $stmt->fetchAll());
        }
        break;

    case 'POST':
        $b = json_decode(file_get_contents('php://input'), true);
        $required = ['username','display_name','platform_id'];
        foreach ($required as $f) if (empty($b[$f])) jsonResponse(false, null, "$f required");

        $stmt = $pdo->prepare("INSERT INTO users (username,display_name,platform_id,followers,following,bio) VALUES (?,?,?,?,?,?)");
        $stmt->execute([
            sanitize($b['username']), sanitize($b['display_name']),
            (int)$b['platform_id'],  (int)($b['followers'] ?? 0),
            (int)($b['following'] ?? 0), sanitize($b['bio'] ?? '')
        ]);
        jsonResponse(true, ['user_id' => (int)$pdo->lastInsertId()], 'User created');
        break;

    case 'PUT':
        $b = json_decode(file_get_contents('php://input'), true);
        $id = (int)($b['user_id'] ?? 0);
        if (!$id) jsonResponse(false, null, 'user_id required');

        $pdo->prepare("UPDATE users SET display_name=?,followers=?,following=?,bio=? WHERE user_id=?")
            ->execute([
                sanitize($b['display_name'] ?? ''),
                (int)($b['followers'] ?? 0), (int)($b['following'] ?? 0),
                sanitize($b['bio'] ?? ''), $id
            ]);
        jsonResponse(true, null, 'User updated');
        break;

    case 'DELETE':
        $b  = json_decode(file_get_contents('php://input'), true);
        $id = (int)($b['user_id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonResponse(false, null, 'user_id required');
        $stmt = $pdo->prepare("DELETE FROM users WHERE user_id=?");
        $stmt->execute([$id]);
        $stmt->rowCount() ? jsonResponse(true, null, 'User deleted') : jsonResponse(false, null, 'Not found');
        break;

    default:
        jsonResponse(false, null, 'Method not allowed');
}