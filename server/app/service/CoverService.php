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

        return self::fromOpenLibrary($title, $author)
            ?: self::fromGoogleBooks($title, $author)
            ?: self::fromDouban($title);
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
        $base = (string) config('cover.openlibrary_search', 'https://openlibrary.org/search.json');

        $query = ['title' => $title, 'limit' => 5, 'fields' => 'title,cover_i,author_name'];
        if ($author !== '') {
            $query['author'] = $author;
        }
        $body = self::get($base . '?' . http_build_query($query));
        $cover = $body === null ? '' : self::parseOpenLibrary($body);

        // 中文作者名常与 OpenLibrary 译名不一致：带作者没命中时，再只用书名试一次
        if ($cover === '' && $author !== '') {
            $body = self::get($base . '?' . http_build_query(['title' => $title, 'limit' => 5, 'fields' => 'title,cover_i,author_name']));
            $cover = $body === null ? '' : self::parseOpenLibrary($body);
        }

        return $cover;
    }

    private static function fromGoogleBooks(string $title, string $author): string
    {
        $q = 'intitle:' . $title;
        if ($author !== '') {
            $q .= '+inauthor:' . $author;
        }
        $base = (string) config('cover.google_books', 'https://www.googleapis.com/books/v1/volumes');
        $query = ['q' => $q, 'maxResults' => 1, 'country' => 'US'];
        $key = (string) config('cover.google_key', '');
        if ($key !== '') {
            $query['key'] = $key;
        }
        $body = self::get($base . '?' . http_build_query($query));

        return $body === null ? '' : self::parseGoogleBooks($body);
    }

    /**
     * 中文书兜底：豆瓣图书搜索页（HTML 内嵌 __DATA__ JSON）
     * 只取书名匹配的第一条 cover_url，降低张冠李戴的概率。
     */
    public static function douban(string $title): string
    {
        if (!config('cover.douban_enabled', true)) {
            return '';
        }

        $base = (string) config('cover.douban_search', 'https://search.douban.com/book/subject_search');
        $url = $base . '?' . http_build_query(['search_text' => $title, 'cat' => 1001]);
        $html = self::get($url, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');
        if ($html === null || $html === '') {
            return '';
        }

        return self::parseDouban($html, $title);
    }

    /**
     * 解析豆瓣搜索页里的 __DATA__ JSON
     */
    public static function parseDouban(string $html, string $title): string
    {
        $pos = strpos($html, 'window.__DATA__ = ');
        if ($pos === false) {
            return '';
        }
        $start = strpos($html, '{', $pos);
        if ($start === false) {
            return '';
        }

        $depth = 0;
        $inStr = false;
        $esc = false;
        $end = null;
        for ($i = $start, $n = strlen($html); $i < $n; $i++) {
            $c = $html[$i];
            if ($inStr) {
                if ($esc) {
                    $esc = false;
                } elseif ($c === '\\') {
                    $esc = true;
                } elseif ($c === '"') {
                    $inStr = false;
                }
                continue;
            }
            if ($c === '"') {
                $inStr = true;
                continue;
            }
            if ($c === '{') {
                $depth++;
            } elseif ($c === '}') {
                $depth--;
                if ($depth === 0) {
                    $end = $i;
                    break;
                }
            }
        }
        if ($end === null) {
            return '';
        }

        $data = json_decode(substr($html, $start, $end - $start + 1), true);
        $items = is_array($data) ? ($data['items'] ?? []) : [];
        $needle = mb_strtolower(self::clean($title));

        foreach ($items as $item) {
            $cover = (string) ($item['cover_url'] ?? '');
            $name = mb_strtolower(self::clean((string) ($item['title'] ?? '')));
            if ($cover === '' || $name === '') {
                continue;
            }
            if ($name === $needle || str_contains($name, $needle) || str_contains($needle, $name)) {
                return str_replace('http://', 'https://', $cover);
            }
        }

        return '';
    }

    private static function fromDouban(string $title): string
    {
        return self::douban($title);
    }

    private static function clean(string $value): string
    {
        $value = str_replace(['《', '》', "\r", "\n", "\t"], ' ', trim($value));

        return trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    }

    private static function get(string $url, ?string $userAgent = null): ?string
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
            CURLOPT_USERAGENT      => $userAgent ?? 'MoyuBooks/5.0 (+https://github.com/chengxuesong123/BookStore)',
            CURLOPT_HTTPHEADER     => ['Accept: text/html,application/json;q=0.9,*/*;q=0.8'],
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $proxy = (string) config('cover.proxy', '');
        if ($proxy !== '') {
            curl_setopt($ch, CURLOPT_PROXY, $proxy);
        }

        // CA 证书：优先配置，其次仓库自带的 cacert.pem；都没有就不校验
        $cainfo = (string) config('cover.cainfo', '');
        if ($cainfo === '') {
            $candidate = root_path() . 'database' . DIRECTORY_SEPARATOR . 'cacert.pem';
            if (is_file($candidate)) {
                $cainfo = $candidate;
            }
        }
        if ($cainfo !== '' && is_file($cainfo)) {
            curl_setopt($ch, CURLOPT_CAINFO, $cainfo);
        } else {
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        }

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
