<?php
declare(strict_types=1);

namespace app\service;

/**
 * 书籍封面自动获取：
 *   1) Open Library Search → cover_i → covers.openlibrary.org
 *   2) 找不到再用 Google Books volumes → imageLinks
 * 任一环节失败都返回空串，由前端用确定性渐变占位，绝不阻塞保存。
 */
class CoverService
{
    public static function find(string $title, string $author = ''): string
    {
        $title = self::clean($title);
        if ($title === '') {
            return '';
        }
        if (!config('cover.enabled', true)) {
            return '';
        }

        $author = self::clean($author);

        return self::fromOpenLibrary($title, $author) ?: self::fromGoogleBooks($title, $author);
    }

    /**
     * 解析 Open Library 搜索结果（独立出来便于单测）
     */
    public static function parseOpenLibrary(string $json): string
    {
        $data = json_decode($json, true);
        if (!is_array($data) || empty($data['docs']) || !is_array($data['docs'])) {
            return '';
        }

        $tpl = (string) config('cover.openlibrary_covers', 'https://covers.openlibrary.org/b/id/%s-L.jpg');

        foreach ($data['docs'] as $doc) {
            if (!is_array($doc) || empty($doc['cover_i'])) {
                continue;
            }

            return sprintf($tpl, (int) $doc['cover_i']);
        }

        return '';
    }

    /**
     * 解析 Google Books 响应（独立出来便于单测）
     */
    public static function parseGoogleBooks(string $json): string
    {
        $data = json_decode($json, true);
        if (!is_array($data) || empty($data['items']) || !is_array($data['items'])) {
            return '';
        }

        foreach ($data['items'] as $item) {
            $links = $item['volumeInfo']['imageLinks'] ?? null;
            if (!is_array($links)) {
                continue;
            }
            $url = $links['thumbnail'] ?? $links['smallThumbnail'] ?? '';
            if (is_string($url) && $url !== '') {
                return self::normalizeGoogleUrl($url);
            }
        }

        return '';
    }

    public static function normalizeGoogleUrl(string $url): string
    {
        $url = preg_replace('#^http:#', 'https:', $url) ?? $url;

        return str_replace('&edge=curl', '', $url);
    }

    private static function fromOpenLibrary(string $title, string $author): string
    {
        $query = ['title' => $title, 'limit' => 5, 'fields' => 'title,cover_i,author_name'];
        if ($author !== '') {
            $query['author'] = $author;
        }

        $base = (string) config('cover.openlibrary_search', 'https://openlibrary.org/search.json');
        $body = self::get($base . '?' . http_build_query($query));

        return $body === null ? '' : self::parseOpenLibrary($body);
    }

    private static function fromGoogleBooks(string $title, string $author): string
    {
        $q = 'intitle:' . $title;
        if ($author !== '') {
            $q .= '+inauthor:' . $author;
        }
        $base = (string) config('cover.google_books', 'https://www.googleapis.com/books/v1/volumes');
        $body = self::get($base . '?' . http_build_query(['q' => $q, 'maxResults' => 1, 'country' => 'US']));

        return $body === null ? '' : self::parseGoogleBooks($body);
    }

    private static function clean(string $value): string
    {
        $value = str_replace(['《', '》', "\r", "\n", "\t"], ' ', trim($value));

        return trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    }

    private static function get(string $url): ?string
    {
        if (!function_exists('curl_init')) {
            return null;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT        => max(1, (int) config('cover.timeout', 5)),
            CURLOPT_USERAGENT      => 'MoyuBooks/4.0 (+https://github.com/chengxuesong123/BookStore)',
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false || $error !== '' || $code >= 400) {
            return null;
        }

        return (string) $body;
    }
}
