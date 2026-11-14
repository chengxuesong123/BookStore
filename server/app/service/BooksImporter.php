<?php
declare(strict_types=1);

namespace app\service;

use RuntimeException;
use think\facade\Db;

/**
 * 从 CSV 导入真实书目：php think books:import
 * CSV 列：title,author,publisher,category,price,original_price,stock,intro,tags
 */
class BooksImporter
{
    /**
     * @return array{imported:int, skipped:int}
     */
    public static function import(string $file, bool $truncate = false): array
    {
        if (!is_file($file)) {
            throw new RuntimeException('CSV 不存在：' . $file);
        }

        $fp = fopen($file, 'rb');
        if ($fp === false) {
            throw new RuntimeException('打不开 CSV：' . $file);
        }

        $header = fgetcsv($fp);
        if ($header === false) {
            fclose($fp);
            throw new RuntimeException('CSV 是空的');
        }
        // 去 BOM
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
        $header = array_map('trim', $header);
        $index = array_flip($header);
        foreach (['title', 'author', 'publisher', 'category', 'price'] as $col) {
            if (!isset($index[$col])) {
                fclose($fp);
                throw new RuntimeException('CSV 缺少列：' . $col);
            }
        }

        $categories = [];
        foreach (Db::name('categories')->field('id,name')->select()->toArray() as $c) {
            $categories[$c['name']] = (int) $c['id'];
        }

        $rows = [];
        $seen = [];
        $skipped = 0;
        while (($line = fgetcsv($fp)) !== false) {
            if (count($line) < 5) {
                $skipped++;
                continue;
            }
            $title = trim((string) $line[$index['title']]);
            $category = trim((string) $line[$index['category']]);
            $author = trim((string) $line[$index['author']]);
            if ($title === '' || !isset($categories[$category])) {
                $skipped++;
                continue;
            }
            if (isset($seen[$title])) {
                $skipped++;
                continue;
            }
            $seen[$title] = true;

            $price = (float) ($line[$index['price']] ?? 0);
            $original = (float) ($line[$index['original_price']] ?? 0);
            $stock = (int) ($line[$index['stock']] ?? 0);
            $tags = trim((string) ($line[$index['tags']] ?? ''));
            $intro = trim((string) ($line[$index['intro']] ?? ''));

            $rows[] = [
                'category_id'    => $categories[$category],
                'title'          => mb_substr($title, 0, 120),
                'author'         => mb_substr($author, 0, 80),
                'publisher'      => mb_substr(trim((string) $line[$index['publisher']]), 0, 80),
                'price'          => max(0.01, $price),
                'original_price' => max(0, $original),
                'stock'          => max(0, $stock),
                'cover'          => '',
                'intro'          => $intro,
                'tags'           => mb_substr($tags, 0, 120),
                'status'         => 'on',
                'created_at'     => date('Y-m-d H:i:s'),
            ];
        }
        fclose($fp);

        if (!$rows) {
            throw new RuntimeException('CSV 没有可导入的行');
        }

        Db::startTrans();
        try {
            if ($truncate) {
                Db::execute('DELETE FROM `cart_items`');
                Db::execute('DELETE FROM `books`');
                Db::execute('ALTER TABLE `books` AUTO_INCREMENT = 1');
            }
            foreach (array_chunk($rows, 100) as $chunk) {
                Db::name('books')->insertAll($chunk);
            }
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            throw new RuntimeException('导入失败：' . $e->getMessage(), 0, $e);
        }

        return ['imported' => count($rows), 'skipped' => $skipped];
    }
}
