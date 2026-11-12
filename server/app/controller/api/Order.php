<?php
declare(strict_types=1);

namespace app\controller\api;

use app\exception\ApiException;
use app\model\Book as BookModel;
use app\model\Order as OrderModel;
use app\model\OrderItem;
use app\service\CartService;
use think\facade\Db;

class Order extends ApiBase
{
    /**
     * 购物车结算预览
     */
    public function checkoutCart()
    {
        $this->requireUser();
        $items = CartService::items();
        if (!$items) {
            throw new ApiException(42200, '购物车是空的', 422);
        }

        return $this->ok([
            'mode'   => 'cart',
            'items'  => $this->lines($items),
            'totals' => CartService::totals($items),
        ]);
    }

    /**
     * 立即购买预览：只读，不写购物车
     */
    public function checkoutDirect()
    {
        $this->requireUser();
        $bookId = (int) $this->request->get('book_id', 0);
        $qty    = max(1, (int) $this->request->get('qty', 1));

        $line = $this->directLine($bookId, $qty);
        $lines = [$line];

        return $this->ok([
            'mode'   => 'direct',
            'items'  => $this->lines($lines),
            'totals' => CartService::totals($lines),
        ]);
    }

    /**
     * 下单：mode=cart 清空购物车；mode=direct 不碰购物车
     */
    public function create()
    {
        $user = $this->requireUser();

        $mode     = (string) ($this->body()['mode'] ?? 'cart');
        $bookId   = (int) ($this->body()['book_id'] ?? 0);
        $qty      = max(1, (int) ($this->body()['qty'] ?? 1));
        $receiver = trim((string) ($this->body()['receiver'] ?? ''));
        $phone    = trim((string) ($this->body()['phone'] ?? ''));
        $address  = trim((string) ($this->body()['address'] ?? ''));
        $remark   = trim((string) ($this->body()['remark'] ?? ''));

        if (!in_array($mode, ['cart', 'direct'], true)) {
            throw new ApiException(40000, '下单方式不正确', 400);
        }

        $errors = [];
        if (mb_strlen($receiver) < 2 || mb_strlen($receiver) > 40) {
            $errors['receiver'] = '请填写收货人姓名（至少 2 个字）';
        }
        if (!preg_match('/^1\d{10}$/', $phone)) {
            $errors['phone'] = '请输入正确的 11 位手机号';
        }
        if (mb_strlen($address) < 6 || mb_strlen($address) > 255) {
            $errors['address'] = '地址至少填写 6 个字';
        }
        if (mb_strlen($remark) > 255) {
            $errors['remark'] = '备注不超过 255 字';
        }
        if ($errors) {
            throw new ApiException(42200, (string) reset($errors), 422, ['errors' => $errors]);
        }

        $items = $mode === 'direct'
            ? [$this->directLine($bookId, $qty)]
            : CartService::items();

        if (!$items) {
            throw new ApiException(42200, '购物车是空的', 422);
        }

        $totals = CartService::totals($items);

        Db::startTrans();
        try {
            foreach ($items as $line) {
                $affected = BookModel::where('id', $line['book']['id'])
                    ->where('status', 'on')
                    ->where('stock', '>=', $line['qty'])
                    ->dec('stock', $line['qty'])
                    ->update();

                if ($affected !== 1) {
                    throw new ApiException(42200, '《' . $line['book']['title'] . '》库存不足', 422);
                }
            }

            $order = OrderModel::create([
                'order_no'     => $this->makeOrderNo(),
                'user_id'      => (int) $user['id'],
                'receiver'     => $receiver,
                'phone'        => $phone,
                'address'      => $address,
                'remark'       => $remark,
                'total_amount' => $totals['total'],
                'status'       => 'pending',
                'source'       => $mode,
            ]);

            foreach ($items as $line) {
                OrderItem::create([
                    'order_id'   => $order['id'],
                    'book_id'    => $line['book']['id'],
                    'book_title' => $line['book']['title'],
                    'cover'      => (string) $line['book']['cover'],
                    'price'      => (float) $line['book']['price'],
                    'quantity'   => (int) $line['qty'],
                ]);
            }

            Db::commit();
        } catch (ApiException $e) {
            Db::rollback();
            throw $e;
        } catch (\Throwable $e) {
            Db::rollback();
            throw new ApiException(50000, '下单失败，请稍后重试', 500);
        }

        if ($mode === 'cart') {
            CartService::clear();
        }

        return $this->ok(['order_id' => (int) $order['id'], 'order_no' => (string) $order['order_no']], '下单成功');
    }

    public function index()
    {
        $user = $this->requireUser();
        $orders = OrderModel::where('user_id', (int) $user['id'])->order('id', 'desc')->paginate(10);

        $list = [];
        foreach ($orders->items() as $order) {
            $list[] = $this->orderArray($order, true);
        }

        return $this->ok([
            'list'      => $list,
            'total'     => (int) $orders->total(),
            'page'      => (int) $orders->currentPage(),
            'page_size' => (int) $orders->listRows(),
        ]);
    }

    public function detail($id)
    {
        $order = $this->findOwnOrder((int) $id);

        return $this->ok(['order' => $this->orderArray($order, true)]);
    }

    public function pay($id)
    {
        $order = $this->findOwnOrder((int) $id);
        if ($order['status'] !== 'pending') {
            throw new ApiException(42200, '当前状态不能付款', 422);
        }
        $order->save(['status' => 'paid']);

        return $this->ok(['order' => $this->orderArray($order, true)], '付款成功（模拟）');
    }

    public function cancel($id)
    {
        $order = $this->findOwnOrder((int) $id);
        if ($order['status'] !== 'pending') {
            throw new ApiException(42200, '只有待付款订单可以取消', 422);
        }

        Db::startTrans();
        try {
            $order->save(['status' => 'cancelled']);
            $this->restoreStock($order);
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            throw new ApiException(50000, '取消失败，请稍后再试', 500);
        }

        return $this->ok(['order' => $this->orderArray($order, true)], '订单已取消，库存已回补');
    }

    public function receive($id)
    {
        $order = $this->findOwnOrder((int) $id);
        if ($order['status'] !== 'shipped') {
            throw new ApiException(42200, '当前状态不能确认收货', 422);
        }
        $order->save(['status' => 'done']);

        return $this->ok(['order' => $this->orderArray($order, true)], '已确认收货');
    }

    /**
     * 回补库存（取消订单用，调用方负责事务）
     */
    public static function restoreStock(OrderModel $order): void
    {
        foreach (OrderItem::where('order_id', $order['id'])->select() as $item) {
            BookModel::where('id', $item['book_id'])->inc('stock', (int) $item['quantity'])->update();
        }
    }

    private function findOwnOrder(int $id): OrderModel
    {
        $user = $this->requireUser();
        $order = OrderModel::where('id', $id)->find();
        if ($order === null || (int) $order['user_id'] !== (int) $user['id']) {
            throw new ApiException(40400, '订单不存在', 404);
        }

        return $order;
    }

    /**
     * 直接购买的单行数据（不落购物车）
     */
    private function directLine(int $bookId, int $qty): array
    {
        if ($bookId <= 0) {
            throw new ApiException(40000, '缺少图书参数', 400);
        }

        $book = BookModel::where('id', $bookId)->where('status', 'on')->find();
        if ($book === null) {
            throw new ApiException(40400, '图书不存在或已下架', 404);
        }
        if ((int) $book['stock'] <= 0) {
            throw new ApiException(42200, '这本书暂时缺货', 422);
        }

        $qty = min($qty, (int) $book['stock']);
        if ($qty <= 0) {
            $qty = 1;
        }

        return [
            'book'       => $book,
            'qty'        => $qty,
            'line_total' => round($qty * (float) $book['price'], 2),
        ];
    }

    private function lines(array $items): array
    {
        $lines = [];
        foreach ($items as $line) {
            $lines[] = [
                'book'       => $this->bookArray($line['book']),
                'qty'        => (int) $line['qty'],
                'line_total' => (float) $line['line_total'],
            ];
        }

        return $lines;
    }

    private function orderArray(OrderModel $order, bool $withItems = false): array
    {
        $row = [
            'id'           => (int) $order['id'],
            'order_no'     => (string) $order['order_no'],
            'status'       => (string) $order['status'],
            'status_text'  => order_status_text((string) $order['status']),
            'source'       => (string) ($order['source'] ?? 'cart'),
            'total_amount' => (float) $order['total_amount'],
            'receiver'     => (string) $order['receiver'],
            'phone'        => (string) $order['phone'],
            'address'      => (string) $order['address'],
            'remark'       => (string) $order['remark'],
            'created_at'   => (string) $order['created_at'],
        ];

        if ($withItems) {
            $row['items'] = array_map(fn($it) => [
                'book_id'    => (int) $it['book_id'],
                'book_title' => (string) $it['book_title'],
                'cover'      => (string) $it['cover'],
                'price'      => (float) $it['price'],
                'quantity'   => (int) $it['quantity'],
                'line_total' => round((float) $it['price'] * (int) $it['quantity'], 2),
            ], OrderItem::where('order_id', $order['id'])->select()->toArray());
        }

        return $row;
    }

    private function makeOrderNo(): string
    {
        do {
            $no = 'MY' . date('YmdHis') . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (OrderModel::where('order_no', $no)->find() !== null);

        return $no;
    }
}
