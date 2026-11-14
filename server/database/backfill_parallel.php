<?php
/**
 * 并行补封面（Open Library 搜索 → cover_i；没有 cover_i 时用 ISBN → covers?b=isbn）
 *   php database/backfill_parallel.php --limit=500 --workers=12
 * 只为 cover='' 的书查询；命中写回 books.cover，未命中留给本地 SVG。
 */
require __DIR__ . '/../vendor/autoload.php';

$app = new think\App();
$app->initialize();

use app\service\CoverService;
use think\facade\Db;

$options = getopt('', ['limit::', 'workers::', 'batch-sleep::']);
$limit = isset($options['limit']) ? (int) $options['limit'] : 500;
$workers = max(1, min(20, isset($options['workers']) ? (int) $options['workers'] : 12));
$batchSleep = isset($options['batch-sleep']) ? (int) $options['batch-sleep'] : 200;

$books = Db::name('books')->field('id,title,author')->where('cover', '')->order('id', 'asc')->limit($limit)->select()->toArray();
$total = count($books);
if ($total === 0) {
    echo "没有需要补封面的书。\n";
    exit(0);
}

$proxy = (string) config('cover.proxy', '');
$cainfo = (string) config('cover.cainfo', '');
if ($cainfo === '') {
    $candidate = root_path() . 'database' . DIRECTORY_SEPARATOR . 'cacert.pem';
    if (is_file($candidate)) {
        $cainfo = $candidate;
    }
}
$searchBase = (string) config('cover.openlibrary_search', 'https://openlibrary.org/search.json');
$isbnBase = 'https://covers.openlibrary.org/b/isbn/%s-L.jpg';
$timeout = max(3, (int) config('cover.timeout', 8));

function setupHandle($url, $proxy, $cainfo, $timeout)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_USERAGENT      => 'MoyuBooks/5.0 (+https://github.com/chengxuesong123/BookStore)',
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($proxy !== '') {
        curl_setopt($ch, CURLOPT_PROXY, $proxy);
    }
    if ($cainfo !== '' && is_file($cainfo)) {
        curl_setopt($ch, CURLOPT_CAINFO, $cainfo);
    } else {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    }

    return $ch;
}

function runMulti(array $handles): array
{
    $multi = curl_multi_init();
    foreach ($handles as $ch) {
        curl_multi_add_handle($multi, $ch);
    }
    do {
        $status = curl_multi_exec($multi, $running);
        if ($running) {
            curl_multi_select($multi, 1.0);
        }
    } while ($running && $status === CURLM_OK);
    foreach ($handles as $ch) {
        curl_multi_remove_handle($multi, $ch);
    }
    curl_multi_close($multi);

    return [];
}

$ok = 0;
$miss = 0;
$done = 0;

for ($offset = 0; $offset < $total; $offset += $workers) {
    $chunk = array_slice($books, $offset, $workers);

    // 第一轮：按书名搜索
    $handles = [];
    $byHandle = [];
    foreach ($chunk as $book) {
        $query = ['title' => $book['title'], 'limit' => 5, 'fields' => 'title,cover_i,isbn'];
        $ch = setupHandle($searchBase . '?' . http_build_query($query), $proxy, $cainfo, $timeout + 4);
        $handles[] = $ch;
        $byHandle[(int) $ch] = $book;
    }
    runMulti($handles);

    $pendingIsbn = [];
    foreach ($handles as $ch) {
        $book = $byHandle[(int) $ch];
        $body = (string) curl_multi_getcontent($ch) ?? '';
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cover = ($code === 200 && $body !== '') ? CoverService::parseOpenLibrary($body) : '';
        if ($cover !== '') {
            Db::name('books')->where('id', $book['id'])->update(['cover' => $cover]);
            echo '✔ #' . $book['id'] . ' ' . $book['title'] . "\n";
            $ok++;
            $done++;
        } else {
            $data = json_decode($body, true);
            $isbns = [];
            foreach (($data['docs'] ?? []) as $doc) {
                foreach (($doc['isbn'] ?? []) as $isbn) {
                    $isbns[] = (string) $isbn;
                    if (count($isbns) >= 3) {
                        break 2;
                    }
                }
            }
            if ($isbns) {
                $pendingIsbn[(int) $ch] = ['book' => $book, 'isbns' => $isbns];
            } else {
                $miss++;
                $done++;
            }
        }
        curl_close($ch);
    }

    // 第二轮：用 ISBN 试封面（HEAD 校验存在且不是空白图）
    if ($pendingIsbn) {
        $isbnHandles = [];
        $isbnBook = [];
        foreach ($pendingIsbn as $item) {
            foreach ($item['isbns'] as $isbn) {
                $url = sprintf($isbnBase, rawurlencode($isbn));
                $ch = setupHandle($url, $proxy, $cainfo, 10);
                curl_setopt($ch, CURLOPT_NOBODY, true);
                $isbnHandles[] = $ch;
                $isbnBook[(int) $ch] = ['book' => $item['book'], 'isbn' => $isbn];
            }
        }
        runMulti($isbnHandles);

        $resolved = [];
        foreach ($isbnHandles as $ch) {
            $item = $isbnBook[(int) $ch];
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $size = (int) curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD);
            curl_close($ch);
            $bookId = (int) $item['book']['id'];
            if ($code === 200 && $size > 2000 && !isset($resolved[$bookId])) {
                $resolved[$bookId] = true;
                $cover = sprintf($isbnBase, rawurlencode($item['isbn']));
                Db::name('books')->where('id', $bookId)->update(['cover' => $cover]);
                echo '✔(ISBN) #' . $bookId . ' ' . $item['book']['title'] . "\n";
                $ok++;
            }
        }
        foreach ($pendingIsbn as $item) {
            $bookId = (int) $item['book']['id'];
            if (!isset($resolved[$bookId])) {
                $miss++;
            }
            $done++;
        }
    }

    echo "进度 {$done}/{$total}（成功 {$ok}，未命中 {$miss}）\n";
    usleep($batchSleep * 1000);
}

echo "完成：成功 {$ok}，未命中 {$miss}。\n";
