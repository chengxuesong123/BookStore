<?php
declare(strict_types=1);

namespace app\controller;

use app\BaseController;
use app\model\Book as BookModel;
use app\service\CartService;
use think\facade\View;

class Cart extends BaseController
{
    public function index()
    {
        $items = CartService::items();

        View::assign([
            'nav'    => '/cart',
            'title'  => '购物车 · 墨屿书屋',
            'items'  => $items,
            'totals' => CartService::totals($items),
        ]);

        return View::fetch('cart/index');
    }

    /**
     * 加入购物车
     */
    public function add()
    {
        $bookId = (int) $this->request->post('book_id', 0);
        $qty    = (int) $this->request->post('qty', 1);
        $buyNow = $this->request->post('buy_now') !== null;
        $from   = $this->safeFrom('/cart');

        $book = BookModel::where('id', $bookId)->where('status', 'on')->find();
        if ($book === null) {
            flash_set('这本书暂时买不到', 'error');
            return redirect($from);
        }
        if ((int) $book['stock'] <= 0) {
            flash_set('《' . $book['title'] . '》暂时缺货', 'error');
            return redirect($from);
        }

        $want = max(1, $qty);
        if ($want > (int) $book['stock']) {
            $want = (int) $book['stock'];
            flash_set('库存不足，已按 ' . $want . ' 本加入', 'error');
        } else {
            flash_set('已加入购物车：' . $book['title']);
        }

        CartService::add($bookId, $want);

        return redirect($buyNow ? '/checkout' : $from);
    }

    /**
     * 修改数量
     */
    public function update()
    {
        $bookId = (int) $this->request->post('book_id', 0);
        $qty    = (int) $this->request->post('qty', 1);

        CartService::setQty($bookId, $qty);

        return redirect('/cart');
    }

    /**
     * 移除一行
     */
    public function remove()
    {
        CartService::remove((int) $this->request->post('book_id', 0));

        return redirect('/cart');
    }

    /**
     * 只接受站内相对路径，挡住 //evil.com 这类跳转
     */
    private function safeFrom(string $fallback): string
    {
        $from = (string) $this->request->post('from', '');
        if ($from === '' || !str_starts_with($from, '/') || str_starts_with($from, '//')) {
            return $fallback;
        }
        if (str_starts_with($from, '/cart') || str_starts_with($from, '/login') || str_starts_with($from, '/logout')) {
            return $fallback;
        }

        return $from;
    }
}
