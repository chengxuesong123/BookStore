<?php
declare(strict_types=1);

namespace app\controller\api;

use app\exception\ApiException;
use app\model\Book as BookModel;
use app\service\CartService;

class Cart extends ApiBase
{
    public function index()
    {
        return $this->ok($this->snapshot());
    }

    public function add()
    {
        $bookId = (int) ($this->body()['book_id'] ?? 0);
        $qty    = (int) ($this->body()['qty'] ?? 1);

        $book = BookModel::where('id', $bookId)->where('status', 'on')->find();
        if ($book === null) {
            throw new ApiException(40400, '这本书暂时买不到', 404);
        }
        if ((int) $book['stock'] <= 0) {
            throw new ApiException(42200, '《' . $book['title'] . '》暂时缺货', 422);
        }

        $want = max(1, $qty);
        if ($want > (int) $book['stock']) {
            $want = (int) $book['stock'];
        }
        CartService::add($bookId, $want);

        return $this->ok($this->snapshot(), '已加入购物车');
    }

    public function update()
    {
        $bookId = (int) ($this->body()['book_id'] ?? 0);
        $qty    = (int) ($this->body()['qty'] ?? 1);

        if ($bookId <= 0) {
            throw new ApiException(40000, '参数不完整', 400);
        }

        CartService::setQty($bookId, $qty);

        return $this->ok($this->snapshot(), '已更新');
    }

    public function remove()
    {
        $bookId = (int) ($this->body()['book_id'] ?? 0);
        if ($bookId <= 0) {
            throw new ApiException(40000, '参数不完整', 400);
        }

        CartService::remove($bookId);

        return $this->ok($this->snapshot(), '已移出购物车');
    }

    /**
     * 购物车快照（行 + 金额汇总 + 件数）
     */
    private function snapshot(): array
    {
        $items = CartService::items();
        $lines = [];
        foreach ($items as $line) {
            $lines[] = [
                'book'       => $this->bookArray($line['book']),
                'qty'        => (int) $line['qty'],
                'line_total' => (float) $line['line_total'],
            ];
        }

        return [
            'items'  => $lines,
            'totals' => CartService::totals($items),
            'count'  => CartService::count(),
        ];
    }
}
