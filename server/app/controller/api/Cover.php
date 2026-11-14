<?php
declare(strict_types=1);

namespace app\controller\api;

use app\model\Book as BookModel;
use think\Response;

/**
 * 本地书封：GET /api/cover/{id}
 * 不依赖外网，按分类配色 + 书名/作者/出版社生成 SVG。
 */
class Cover
{
    private const PALETTES = [
        '文学' => ['#5c2620', '#8a3b2e'],
        '历史' => ['#42452a', '#6b6f3d'],
        '科技' => ['#1f3a5f', '#3d5a80'],
        '经济' => ['#6b4b1f', '#9a7434'],
        '童书' => ['#1d4a52', '#2f7a78'],
        '社科' => ['#3b2a56', '#5d4a7a'],
    ];

    public function svg($id)
    {
        $book = BookModel::withCategory()->where('b.id', (int) $id)->find();
        if ($book === null) {
            return response('not found', 404);
        }

        $category = (string) ($book['category_name'] ?? '');
        [$dark, $light] = self::PALETTES[$category] ?? ['#263349', '#3d4f6b'];

        $title = (string) $book['title'];
        $author = (string) $book['author'];
        $publisher = (string) $book['publisher'];

        $lines = self::wrap($title, 5, 3);
        $titleSvg = '';
        $y = 190 - (count($lines) - 1) * 26;
        foreach ($lines as $line) {
            $titleSvg .= '<text x="150" y="' . $y . '" text-anchor="middle" font-size="30" font-weight="700" fill="#ffffff" font-family="Noto Serif SC, Songti SC, serif">'
                . self::esc($line) . '</text>';
            $y += 40;
        }

        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" role="img" aria-label="{$this->attr($title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{$light}"/>
      <stop offset="1" stop-color="{$dark}"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#g)"/>
  <rect x="0" y="0" width="12" height="400" fill="rgba(255,255,255,.16)"/>
  <rect x="12" y="0" width="1" height="400" fill="rgba(0,0,0,.14)"/>
  <circle cx="262" cy="52" r="46" fill="rgba(255,255,255,.08)"/>
  <circle cx="262" cy="52" r="30" fill="rgba(255,255,255,.07)"/>
  <text x="30" y="56" font-size="13" letter-spacing="2" fill="rgba(255,255,255,.85)" font-family="sans-serif">{$this->esc($category !== '' ? $category : '图书')}</text>
  {$titleSvg}
  <text x="150" y="300" text-anchor="middle" font-size="16" fill="rgba(255,255,255,.9)" font-family="sans-serif">{$this->esc($author)}</text>
  <line x1="105" y1="320" x2="195" y2="320" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
  <text x="150" y="352" text-anchor="middle" font-size="12" fill="rgba(255,255,255,.75)" font-family="sans-serif">{$this->esc(mb_substr($publisher, 0, 12))}</text>
</svg>
SVG;

        return response($svg, 200, [
            'Content-Type'  => 'image/svg+xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }

    /**
     * 按字数折行，超出部分省略
     * @return string[]
     */
    private static function wrap(string $text, int $perLine, int $maxLines): array
    {
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $lines = [];
        while ($chars && count($lines) < $maxLines) {
            $lines[] = implode('', array_splice($chars, 0, $perLine));
        }
        if ($chars) {
            $lines[count($lines) - 1] = mb_substr($lines[count($lines) - 1], 0, max(1, $perLine - 1)) . '…';
        }

        return $lines ?: ['无题'];
    }

    private static function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private function attr(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
