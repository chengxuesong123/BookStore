<?php
declare(strict_types=1);

namespace app\command;

use think\console\Command;
use think\console\Input;
use think\console\input\Option;
use think\console\Output;
use think\facade\Db;

/**
 * php think db:init --seed --force
 * 重建库表（会 DROP TABLE），可选导入种子数据。测试用它重置数据库。
 */
class DbInit extends Command
{
    protected function configure(): void
    {
        $this->setName('db:init')
            ->addOption('seed', null, Option::VALUE_NONE, '同时导入种子数据')
            ->addOption('force', null, Option::VALUE_NONE, '确认执行，会删除现有表')
            ->setDescription('重建图书商城库表，可选导入种子数据');
    }

    protected function execute(Input $input, Output $output): int
    {
        if (!$input->getOption('force')) {
            $output->writeln('<comment>会删除现有表，确认请加 --force</comment>');
            return 1;
        }

        $files = ['schema'];
        if ($input->getOption('seed')) {
            $files[] = 'seed';
        }

        foreach ($files as $name) {
            $path = root_path() . 'database' . DIRECTORY_SEPARATOR . $name . '.sql';
            if (!is_file($path)) {
                $output->writeln('<error>缺少文件：' . $path . '</error>');
                return 1;
            }

            $sql       = (string) file_get_contents($path);
            $sql       = (string) preg_replace('/^\s*--.*$/m', '', $sql);
            $statements = array_values(array_filter(array_map('trim', preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [])));

            foreach ($statements as $statement) {
                Db::execute($statement);
            }

            $output->writeln('<info>导入 database/' . $name . '.sql：' . count($statements) . ' 条语句</info>');
        }

        $output->writeln('<info>完成</info>');
        return 0;
    }
}
