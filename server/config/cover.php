<?php
declare(strict_types=1);

return [
    // 封面自动获取：Open Library 优先，Google Books 兜底
    'enabled' => (bool) env('COVER_ENABLED', true),

    // 单次请求超时（秒），失败不阻塞后台保存
    'timeout' => (int) env('COVER_TIMEOUT', 8),

    // 本机代理（Clash 等），如 127.0.0.1:7897；留空则直连
    'proxy' => (string) env('COVER_PROXY', ''),

    // Google Books API Key（可选，无 key 容易被限流 429）
    'google_key' => (string) env('COVER_GOOGLE_KEY', ''),

    // CA 证书：默认用仓库里的 server/database/cacert.pem
    'cainfo' => (string) env('COVER_CAINFO', ''),

    'openlibrary_search' => env('COVER_OPENLIBRARY_SEARCH', 'https://openlibrary.org/search.json'),
    'openlibrary_covers' => env('COVER_OPENLIBRARY_COVERS', 'https://covers.openlibrary.org/b/id/%s-L.jpg'),
    'google_books'       => env('COVER_GOOGLE_BOOKS', 'https://www.googleapis.com/books/v1/volumes'),

    // 中文书兜底：豆瓣搜索页
    'douban_enabled' => (bool) env('COVER_DOUBAN_ENABLED', true),
    'douban_search'  => env('COVER_DOUBAN_SEARCH', 'https://search.douban.com/book/subject_search'),
];
