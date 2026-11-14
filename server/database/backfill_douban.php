<?php
/**
 * 豆瓣并行补封面（中文书兜底）：
 *   php database/backfill_douban.php --limit=500 --workers=5 --batch-sleep=500
 * 只为 cover='' 的书查询；解析搜索页 __DATA__ 里与书名匹配的 cover_url。
 */
require __DIR__ . '/../vendor/autoload.php';

$app = new think\App();
$app->initialize();

use app\service\CoverService;
use think\facade\Db;

$options = getopt('', ['limit::', 'workers::', 'batch-sleep::']);
$limit = isset($options['limit']) ? (int) $options['limit'] : 500;
$workers = max(1, min(10, isset($options['workers']) ? (int) $options['workers'] : 5));
$batchSleep = isset($options['batch-sleep']) ? (int) $options['batch-sleep'] : 500;

$books = Db::name('books')->field('id,title')->where('cover', '')->order('id', 'asc')->limit($limit)->select()->toArray();
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
$base = (string) config('cover.douban_search', 'https://search.douban.com/book/subject_search');
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

$ok = 0;
$miss = 0;
$done = 0;

for ($offset = 0; $offset < $total; $offset += $workers) {
    $chunk = array_slice($books, $offset, $workers);

    $multi = curl_multi_init();
    $handles = [];
    foreach ($chunk as $book) {
        $url = $base . '?' . http_build_query(['search_text' => $book['title'], 'cat' => 1001]);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_USERAGENT      => $ua,
            CURLOPT_HTTPHEADER     => ['Accept: text/html,application/xhtml+xml'],
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
        curl_multi_add_handle($multi, $ch);
        $handles[(int) $ch] = ['handle' => $ch, 'book' => $book];
    }

    do {
        $status = curl_multi_exec($multi, $running);
        if ($running) {
            curl_multi_select($multi, 1.0);
        }
    } while ($running && $status === CURLM_OK);

    foreach ($handles as $item) {
        $ch = $item['handle'];
        $html = (string) curl_multi_getcontent($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cover = $code === 200 ? CoverService::parseDouban($html, $item['book']['title']) : '';
        if ($cover !== '') {
            Db::name('books')->where('id', $item['book']['id'])->update(['cover' => $cover]);
            echo '✔ #' . $item['book']['id'] . ' ' . $item['book']['title'] . "\n";
            $ok++;
        } else {
            $miss++;
        }
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);
        $done++;
    }
    curl_multi_close($multi);

    echo "进度 {$done}/{$total}（成功 {$ok}，未命中 {$miss}）\n";
    usleep($batchSleep * 1000);
}

echo "完成：成功 {$ok}，未命中 {$miss}。\n";
