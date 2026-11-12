<?php
declare(strict_types=1);

namespace app\controller\api\admin;

use app\controller\api\ApiBase;
use app\model\Book;
use app\model\Order;

class Index extends ApiBase
{
    public function stats()
    {
        $this->requireAdmin();

        return $this->ok([
            'book_total' => (int) Book::count(),
            'book_on'    => (int) Book::where('status', 'on')->count(),
            'order_total'=> (int) Order::count(),
            'order_paid' => (int) Order::where('status', 'paid')->count(),
        ]);
    }
}
