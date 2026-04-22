<?php
include 'db_connect.php';

// Expecting POST data: post_id, content
$post_id = $_POST['post_id'] ?? null;
$content = $_POST['content'] ?? null;

if (!$post_id || !$content) {
    echo json_encode(["success" => false, "error" => "Missing required fields"]);
    exit;
}

$sql = "UPDATE Posts SET content=? WHERE post_id=?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("si", $content, $post_id);

if ($stmt->execute()) {
    echo json_encode(["success" => true]);
} else {
    echo json_encode(["success" => false, "error" => $conn->error]);
}

$stmt->close();
$conn->close();
?>
