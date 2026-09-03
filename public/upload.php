<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Debugging: Check what actually arrived
file_put_contents(
  __DIR__ . '/debug.txt',
  print_r($_POST, true),
  FILE_APPEND
);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// FIX: Use Single Quotes here!
$SECRET_KEY = 'vK9#mP2$xL5@jR8&qW3';

$clientKey = $_POST['secret_key'] ?? '';
$clientKey = trim($clientKey);

// Debugging: See what PHP thinks the keys are (remove this after fixing!)
// file_put_contents(__DIR__ . '/debug_keys.txt', "Server: $SECRET_KEY \nClient: $clientKey", FILE_APPEND);

if (!hash_equals($SECRET_KEY, $clientKey)) {
    http_response_code(403);
    echo json_encode([
        "status" => 0,
        "message" => "Unauthorized"
    ]);
    exit();
}

$target_dir = "images/";

// Ensure directory exists
if (!is_dir($target_dir)) {
    mkdir($target_dir, 0755, true);
}

if (!isset($_FILES['file'])) {
    echo json_encode(["status" => 0, "message" => "No file received"]);
    exit();
}

$file_name = uniqid() . "_" . basename($_FILES["file"]["name"]);
$target_file = $target_dir . $file_name;

if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
    echo json_encode([
        "status" => 1,
        "url" => "/images/" . $file_name
    ]);
} else {
    echo json_encode([
        "status" => 0,
        "message" => "Upload failed. Check folder permissions."
    ]);
}
?>