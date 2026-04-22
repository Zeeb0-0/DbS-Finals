<?php
include 'db_connect.php';

$sql = "SELECT * FROM Posts ORDER BY timestamp DESC";
$result = $conn->query($sql);

$posts = [];
while ($row = $result->fetch_assoc()) {
    $posts[] = $row;
}

echo json_encode($posts);

$conn->close();
?>
