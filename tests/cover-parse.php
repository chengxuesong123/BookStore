<?php
/**
 * CoverService 解析单测：不访问外网，直接喂样例 JSON
 * 运行：php tests/cover-parse.php
 */
require __DIR__ . '/../server/vendor/autoload.php';

$app = new think\App();
$app->initialize();

use app\service\CoverService;

$ok = true;
$fail = [];

$ol = CoverService::parseOpenLibrary('{"docs":[{"cover_i":240727},{"cover_i":999}]}');
if ($ol !== 'https://covers.openlibrary.org/b/id/240727-L.jpg') {
    $ok = false;
    $fail[] = 'openlibrary: ' . $ol;
}

$olEmpty = CoverService::parseOpenLibrary('{"docs":[{"title":"no cover"}]}');
if ($olEmpty !== '') {
    $ok = false;
    $fail[] = 'openlibrary-empty: ' . $olEmpty;
}

$gb = CoverService::parseGoogleBooks('{"items":[{"volumeInfo":{"imageLinks":{"thumbnail":"http://books.google.com/books/content?id=x&printsec=frontcover&img=1"}}}]}');
if ($gb !== 'https://books.google.com/books/content?id=x&printsec=frontcover&img=1') {
    $ok = false;
    $fail[] = 'google: ' . $gb;
}

$gbEmpty = CoverService::parseGoogleBooks('{"items":[]}');
if ($gbEmpty !== '') {
    $ok = false;
    $fail[] = 'google-empty: ' . $gbEmpty;
}

if (!$ok) {
    fwrite(STDERR, implode("\n", $fail) . "\n");
    exit(1);
}

echo "cover-parse ok\n";
