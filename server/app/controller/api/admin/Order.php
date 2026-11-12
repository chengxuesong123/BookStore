<?php
declare(strict_types=1);

namespace app\controller\api\admin;

use app\controller\api\ApiBase;
use app\controller\api\Order as ShopOrder;
use app\exception\ApiException;
use app\model\Order as OrderModel;
use app\model\OrderItem;
use think\facade\Db;

class Order extends ApiBase
{
    public function index()
    {
        $this->requireAdmin();
        $status = (string) $this->request->get('status', '');
        $kw     = trim((string) $this->request->get('q', ''));
        $page   = max(1, (int) $this->request->get('page', 1));
        $size   = min(50, max(1, (int) $this->request->get('page_size', 12)));

        $query = Db::name('orders')->alias('o')
            ->leftJoin('users u', 'o.user_id = u.id')
            ->field('o.*, u.email, u.nickname');

        if (in_array($status, ['pending', 'paid', 'shipped', 'done', 'cancelled'], true)) {
            $query->where('o.status', $status);
        }
        if ($kw !== '') {
            $query->where(function ($q) use ($kw) {
                $q->whereLike('o.order_no', '%' . $kw . '%')
                    ->whereOr('u.email', 'like', '%' . $kw . '%');
            });
        }

        $orders = $query->order('o.id', 'desc')->paginate(['list_rows' => $size, 'page' => $page, 'query' => []]);

        $list = [];
        foreach ($orders->items() as $row) {
            $list[] = $this->adminOrderArray($row, false);
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
        $this->requireAdmin();
        $row = Db::name('orders')->alias('o')
            ->leftJoin('users u', 'o.user_id = u.id')
            ->field('o.*, u.email, u.nickname')
            ->where('o.id', (int) $id)
            ->find();

        if (!$row) {
            throw new ApiException(40400, '订单不存在', 404);
        }

        return $this->ok(['order' => $this->adminOrderArray($row, true)]);
    }

    public function ship($id)
    {
        return $this->transition((int) $id, 'paid', 'shipped', '已发货');
    }

    public function complete($id)
    {
        return $this->transition((int) $id, 'shipped', 'done', '订单已完成');
    }

    public function cancel($id)
    {
        $this->requireAdmin();
        $order = OrderModel::find((int) $id);
        if ($order === null) {
            throw new ApiException(40400, '订单不存在', 404);
        }
        if (!in_array($order['status'], ['pending', 'paid'], true)) {
            throw new ApiException(42200, '当前状态不能取消', 422);
        }

        Db::startTrans();
        try {
            $order->save(['status' => 'cancelled']);
            ShopOrder::restoreStock($order);
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            throw new ApiException(50000, '取消失败，请稍后再试', 500);
        }

        return $this->ok(null, '订单已取消，库存已回补');
    }

    private function transition(int $id, string $from, string $to, string $okText)
    {
        $this->requireAdmin();
        $order = OrderModel::find($id);
        if ($order === null) {
            throw new ApiException(40400, '订单不存在', 404);
        }
        if ($order['status'] !== $from) {
            throw new ApiException(42200, '当前状态不能执行该操作', 422);
        }

        $order->save(['status' => $to]);

        return $this->ok(null, $okText);
    }

    private function adminOrderArray(array $row, bool $withItems): array
    {
        $data = [
            'id'           => (int) $row['id'],
            'order_no'     => (string) $row['order_no'],
            'status'       => (string) $row['status'],
            'status_text'  => order_status_text((string) $row['status']),
            'source'       => (string) ($row['source'] ?? 'cart'),
            'total_amount' => (float) $row['total_amount'],
            'receiver'     => (string) $row['receiver'],
            'phone'        => (string) $row['phone'],
            'address'      => (string) $row['address'],
            'remark'       => (string) $row['remark'],
            'created_at'   => (string) $row['created_at'],
            'email'        => (string) ($row['email'] ?? ''),
            'nickname'     => (string) ($row['nickname'] ?? ''),
        ];

        if ($withItems) {
            $data['items'] = array_map(fn($it) => [
                'book_id'    => (int) $it['book_id'],
                'book_title' => (string) $it['book_title'],
                'cover'      => (string) $it['cover'],
                'price'      => (float) $it['price'],
                'quantity'   => (int) $it['quantity'],
                'line_total' => round((float) $it['price'] * (int) $it['quantity'], 2),
            ], OrderItem::where('order_id', $row['id'])->select()->toArray());
        }

        return $data;
    }
}
