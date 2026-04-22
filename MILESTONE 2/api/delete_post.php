<?php
include 'db_connect.php';

// Expecting POST data: post_id
$post_id = $_POST['post_id'] ?? null;

if (!$post_id) {
    echo json_encode(["success" => false, "error" => "Missing post_id"]);
    exit;
}

$sql = "DELETE FROM Posts WHERE post_id=?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $post_id);

if ($stmt->execute()) {
    echo json_encode(["success" => true]);
} else {
    echo json_encode(["success" => false, "error" => $conn->error]);
}

$stmt->close();
$conn->close();
?>
