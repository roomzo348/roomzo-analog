<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$SECRET_KEY = 'vK9#mP2$xL5@jR8&qW3';
$clientKey = trim($_POST['secret_key'] ?? '');

if (!hash_equals($SECRET_KEY, $clientKey)) {
    http_response_code(403);
    echo json_encode(["status" => 0, "message" => "Unauthorized"]);
    exit();
}

if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    echo json_encode(["status" => 0, "message" => "No file received"]);
    exit();
}

/**
 * Files live in storage/images (outside public_html).
 * public_html/images should be a symlink to that folder.
 */
function resolveUploadDir(): string {
    $candidates = [
        dirname(__DIR__) . '/storage/images',
        __DIR__ . '/../storage/images',
        __DIR__ . '/images',
    ];

    foreach ($candidates as $dir) {
        $dir = rtrim(str_replace('\\', '/', $dir), '/');
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        if (is_dir($dir) && is_writable($dir)) {
            $real = realpath($dir);
            return $real !== false ? $real : $dir;
        }
    }

    return dirname(__DIR__) . '/storage/images';
}

$target_dir = resolveUploadDir();
if (!is_dir($target_dir) && !@mkdir($target_dir, 0755, true)) {
    echo json_encode([
        "status" => 0,
        "message" => "Upload folder not writable. Check storage/images permissions and symlink.",
        "dir" => $target_dir,
    ]);
    exit();
}

$original = basename($_FILES['file']['name']);
$original = preg_replace('/[^A-Za-z0-9._-]/', '_', $original);
$file_name = uniqid() . '_' . $original;
$target_file = $target_dir . DIRECTORY_SEPARATOR . $file_name;

if (move_uploaded_file($_FILES['file']['tmp_name'], $target_file)) {
    echo json_encode([
        "status" => 1,
        "url" => "/images/" . $file_name
    ]);
} else {
    echo json_encode([
        "status" => 0,
        "message" => "Upload failed. Check storage/images permissions and that public_html/images is a symlink.",
        "dir" => $target_dir,
    ]);
}
?>
