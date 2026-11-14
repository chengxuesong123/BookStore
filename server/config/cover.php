<?php
declare(strict_types=1);

return [
    // 封面自动获取：Open Library 优先，Google Books 兜底
    'enabled' => (bool) env('COVER_ENABLED', true),

    // 单次请求超时（秒），失败不阻塞后台保存
    'timeout' => (int) env('COVER_TIMEOUT', 5),

    'openlibrary_search' => env('COVER_OPENLIBRARY_SEARCH', 'https://openlibrary.org/search.json'),
    'openlibrary_covers' => env('COVER_OPENLIBRARY_COVERS', 'https://covers.openlibrary.org/b/id/%s-L.jpg'),
    'google_books'       => env('COVER_GOOGLE_BOOKS', 'https://www.googleapis.com/books/v1/volumes'),
];
