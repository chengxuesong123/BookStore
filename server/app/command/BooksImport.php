<?php
declare(strict_types=1);

namespace app\command;

use app\service\BooksImporter;
use think\console\Command;
use think\console\Input;
use think\console\input\Option;
use think\console\Output;

/**
 * php think books:import --file=database/books-real.csv --truncate
 */
class BooksImport extends Command
{
    protected function configure(): void
    {
        $this->setName('books:import')
            ->addOption('file', null, Option::VALUE_REQUIRED, 'CSV 路径（相对项目根目录）', 'database/books-real.csv')
            ->addOption('truncate', null, Option::VALUE_NONE, '先清空 books 与 cart_items')
            ->setDescription('从 CSV 导入真实书目');
    }

    protected function execute(Input $input, Output $output): int
    {
        $file = (string) $input->getOption('file');
        if (!preg_match('#^[A-Za-z]:#', $file)) {
            $file = root_path() . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $file);
        }

        try {
            $stat = BooksImporter::import($file, (bool) $input->getOption('truncate'));
        } catch (\Throwable $e) {
            $output->writeln('<error>' . $e->getMessage() . '</error>');
            return 1;
        }

        $output->writeln("<info>导入完成：{$stat['imported']} 本，跳过 {$stat['skipped']}</info>");
        return 0;
    }
}
