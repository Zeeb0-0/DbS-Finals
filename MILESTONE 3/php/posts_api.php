<?php
// ============================================================
//  posts_api.php — CRUD operations for posts + engagement
// ============================================================
require_once __DIR__ . '/db_config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = getDBConnection();

// ── Route ───────────────────────────────────────────────────
switch ($method) {
    case 'GET':    handleGet($pdo);    break;
    case 'POST':   handlePost($pdo);   break;
    case 'PUT':    handlePut($pdo);    break;
    case 'DELETE': handleDelete($pdo); break;
    default:       jsonResponse(false, null, 'Method not allowed'); break;
}

// ── READ ─────────────────────────────────────────────────────
function handleGet(PDO $pdo): void {
    $action  = $_GET['action']  ?? 'list';
    $post_id = (int)($_GET['id'] ?? 0);

    if ($action === 'single' && $post_id > 0) {
        $stmt = $pdo->prepare("
            SELECT p.*, u.username, u.display_name, pl.platform_name,
                   em.likes, em.shares, em.comments, em.views, em.clicks,
                   sr.sentiment_label, sr.compound_score
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            JOIN platforms pl ON u.platform_id = pl.platform_id
            LEFT JOIN engagement_metrics em ON p.post_id = em.post_id
            LEFT JOIN sentiment_results sr  ON p.post_id = sr.post_id
            WHERE p.post_id = ?
        ");
        $stmt->execute([$post_id]);
        $row = $stmt->fetch();
        $row ? jsonResponse(true, $row) : jsonResponse(false, null, 'Post not found');
        return;
    }

    if ($action === 'stats') {
        $stmt = $pdo->query("SELECT * FROM vw_user_stats ORDER BY total_engagement DESC");
        jsonResponse(true, $stmt->fetchAll());
        return;
    }

    if ($action === 'platform_breakdown') {
        $stmt = $pdo->query("
            SELECT pl.platform_name,
                   COUNT(p.post_id)            AS post_count,
                   SUM(em.likes)               AS total_likes,
                   SUM(em.shares)              AS total_shares,
                   SUM(em.comments)            AS total_comments,
                   SUM(em.views)               AS total_views,
                   AVG(em.likes+em.shares+em.comments) AS avg_engagement
            FROM platforms pl
            LEFT JOIN users u    ON pl.platform_id = u.platform_id
            LEFT JOIN posts p    ON u.user_id       = p.user_id
            LEFT JOIN engagement_metrics em ON p.post_id = em.post_id
            GROUP BY pl.platform_id, pl.platform_name
            ORDER BY total_likes DESC
        ");
        jsonResponse(true, $stmt->fetchAll());
        return;
    }

    if ($action === 'sentiment_summary') {
        $stmt = $pdo->query("
            SELECT sentiment_label, COUNT(*) AS count,
                   AVG(compound_score) AS avg_score
            FROM sentiment_results
            GROUP BY sentiment_label
        ");
        jsonResponse(true, $stmt->fetchAll());
        return;
    }

    if ($action === 'top_hashtags') {
        $stmt = $pdo->query("
            SELECT h.hashtag_text, COUNT(*) AS usage_count
            FROM post_hashtags ph
            JOIN hashtags h ON ph.hashtag_id = h.hashtag_id
            GROUP BY h.hashtag_id, h.hashtag_text
            ORDER BY usage_count DESC
            LIMIT 15
        ");
        jsonResponse(true, $stmt->fetchAll());
        return;
    }

    // Default: full post list
    $user_id    = (int)($_GET['user_id'] ?? 0);
    $platform   = sanitize($_GET['platform'] ?? '');
    $sentiment  = sanitize($_GET['sentiment'] ?? '');
    $sort       = in_array($_GET['sort'] ?? '', ['likes','shares','comments','views','post_date'])
                    ? $_GET['sort'] : 'post_date';
    $order      = ($_GET['order'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

    $where  = [];
    $params = [];

    if ($user_id > 0)   { $where[] = 'p.user_id = ?';         $params[] = $user_id; }
    if ($platform !== '') { $where[] = 'pl.platform_name = ?'; $params[] = $platform; }
    if ($sentiment !== '') { $where[] = 'sr.sentiment_label = ?'; $params[] = $sentiment; }

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $sortCol  = in_array($sort, ['likes','shares','comments','views'])
                    ? "em.$sort" : "p.post_date";

    $sql = "
        SELECT p.post_id, p.post_content, p.post_date,
               u.username, u.display_name, pl.platform_name,
               em.likes, em.shares, em.comments, em.views, em.clicks,
               (em.likes + em.shares + em.comments) AS total_engagement,
               sr.sentiment_label, sr.compound_score
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
        JOIN platforms pl ON u.platform_id = pl.platform_id
        LEFT JOIN engagement_metrics em ON p.post_id = em.post_id
        LEFT JOIN sentiment_results  sr ON p.post_id = sr.post_id
        $whereSQL
        ORDER BY $sortCol $order
        LIMIT 100
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    jsonResponse(true, $stmt->fetchAll());
}

// ── CREATE ───────────────────────────────────────────────────
function handlePost(PDO $pdo): void {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { jsonResponse(false, null, 'Invalid JSON body'); }

    $user_id     = (int)($body['user_id']     ?? 0);
    $post_content = trim($body['post_content'] ?? '');
    $post_date   = $body['post_date']   ?? date('Y-m-d H:i:s');
    $post_url    = sanitize($body['post_url'] ?? '');
    $likes       = (int)($body['likes']    ?? 0);
    $shares      = (int)($body['shares']   ?? 0);
    $comments    = (int)($body['comments'] ?? 0);
    $views       = (int)($body['views']    ?? 0);
    $clicks      = (int)($body['clicks']   ?? 0);

    if ($user_id <= 0 || $post_content === '') {
        jsonResponse(false, null, 'user_id and post_content are required');
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO posts (user_id, post_content, post_date, post_url)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$user_id, $post_content, $post_date, $post_url ?: null]);
        $post_id = (int)$pdo->lastInsertId();

        $pdo->prepare("
            INSERT INTO engagement_metrics (post_id, likes, shares, comments, views, clicks)
            VALUES (?, ?, ?, ?, ?, ?)
        ")->execute([$post_id, $likes, $shares, $comments, $views, $clicks]);

        $pdo->commit();
        jsonResponse(true, ['post_id' => $post_id], 'Post created successfully');
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(false, null, 'DB error: ' . $e->getMessage());
    }
}

// ── UPDATE ───────────────────────────────────────────────────
function handlePut(PDO $pdo): void {
    $body    = json_decode(file_get_contents('php://input'), true);
    $post_id = (int)($body['post_id'] ?? 0);
    if ($post_id <= 0) { jsonResponse(false, null, 'post_id required'); }

    $pdo->beginTransaction();
    try {
        if (!empty($body['post_content'])) {
            $pdo->prepare("UPDATE posts SET post_content=?, post_date=? WHERE post_id=?")
                ->execute([
                    trim($body['post_content']),
                    $body['post_date'] ?? date('Y-m-d H:i:s'),
                    $post_id
                ]);
        }

        $fields  = ['likes','shares','comments','views','clicks'];
        $updates = [];
        $params  = [];
        foreach ($fields as $f) {
            if (isset($body[$f])) { $updates[] = "$f=?"; $params[] = (int)$body[$f]; }
        }
        if ($updates) {
            $params[] = $post_id;
            $pdo->prepare("UPDATE engagement_metrics SET " . implode(',', $updates) . " WHERE post_id=?")
                ->execute($params);
        }

        $pdo->commit();
        jsonResponse(true, null, 'Post updated successfully');
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(false, null, 'DB error: ' . $e->getMessage());
    }
}

// ── DELETE ───────────────────────────────────────────────────
function handleDelete(PDO $pdo): void {
    $body    = json_decode(file_get_contents('php://input'), true);
    $post_id = (int)($body['post_id'] ?? $_GET['id'] ?? 0);
    if ($post_id <= 0) { jsonResponse(false, null, 'post_id required'); }

    $stmt = $pdo->prepare("DELETE FROM posts WHERE post_id = ?");
    $stmt->execute([$post_id]);
    $stmt->rowCount() > 0
        ? jsonResponse(true, null, 'Post deleted')
        : jsonResponse(false, null, 'Post not found');
}