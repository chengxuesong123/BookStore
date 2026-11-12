<?php
declare(strict_types=1);

namespace app\controller\admin;

use app\BaseController;
use app\model\Book;
use app\model\Order;
use think\facade\View;

class Index extends BaseController
{
    public function index()
    {
        $stats = [
            ['k' => '图书总数', 'v' => Book::count()],
            ['k' => '在售图书', 'v' => Book::where('status', 'on')->count()],
            ['k' => '订单总数', 'v' => Order::count()],
            ['k' => '待发货', 'v' => Order::where('status', 'paid')->count(), 'accent' => true],
        ];

        View::assign([
            'nav'   => 'admin',
            'title' => '后台管理 · 墨屿书屋',
            'stats' => $stats,
        ]);

        return View::fetch('index');
    }
}
