<?php
declare(strict_types=1);

namespace app\command;

use app\model\Book as BookModel;
use app\service\CoverService;
use think\console\Command;
use think\console\Input;
use think\console\input\Option;
use think\console\Output;

/**
 * 给还没有封面的书补封面：
 *   php think cover:backfill --limit=50 --offset=0
 * 会依次尝试 Open Library → Google Books，失败就跳过（前端有渐变占位）。
 */
class CoverBackfill extends Command
{
    protected function configure()
    {
        $this->setName('cover:backfill')
            ->addOption('limit', null, Option::VALUE_REQUIRED, '最多处理多少本', 50)
            ->addOption('offset', null, Option::VALUE_REQUIRED, '跳过前多少本', 0)
            ->addOption('sleep', null, Option::VALUE_REQUIRED, '每本之间休眠毫秒数', 250)
            ->setDescription('按书名补全书籍封面（Open Library 优先，Google Books 兜底）');
    }

    protected function execute(Input $input, Output $output)
    {
        $limit = max(1, (int) $input->getOption('limit'));
        $offset = max(0, (int) $input->getOption('offset'));
        $sleepMs = max(0, (int) $input->getOption('sleep'));

        $books = BookModel::where('cover', '')->order('id', 'asc')->limit($offset, $limit)->select();
        if (count($books) === 0) {
            $output->writeln('没有需要补封面的书。');

            return 0;
        }

        $ok = 0;
        $miss = 0;
        foreach ($books as $book) {
            $url = CoverService::find((string) $book['title'], (string) $book['author']);
            if ($url !== '') {
                $book->save(['cover' => $url]);
                $ok++;
                $output->writeln('✔ #' . $book['id'] . ' ' . $book['title'] . ' → ' . $url);
            } else {
                $miss++;
                $output->writeln('· #' . $book['id'] . ' ' . $book['title'] . ' 未找到');
            }
            if ($sleepMs > 0) {
                usleep($sleepMs * 1000);
            }
        }

        $output->writeln("完成：成功 {$ok}，未找到 {$miss}。");

        return 0;
    }
}
