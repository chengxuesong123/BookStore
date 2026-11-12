<?php
declare(strict_types=1);

namespace app\controller\admin;

use app\BaseController;
use app\controller\Order as ShopOrder;
use app\model\Order as OrderModel;
use app\model\OrderItem;
use app\model\User;
use think\facade\Db;
use think\facade\View;

class Order extends BaseController
{
    /**
     * 订单列表
     */
    public function index()
    {
        $status = (string) $this->request->get('status', '');
        $kw     = trim((string) $this->request->get('q', ''));

        $query = Db::name('orders')->alias('o')
            ->leftJoin('users u', 'o.user_id = u.id')
            ->field('o.*, u.email, u.nickname');

        if (in_array($status, ['pending', 'paid', 'shipped', 'done', 'cancelled'], true)) {
            $query->where('o.status', $status);
        } else {
            $status = '';
        }
        if ($kw !== '') {
            $query->where(function ($q) use ($kw) {
                $q->whereLike('o.order_no', '%' . $kw . '%')
                    ->whereOr('u.email', 'like', '%' . $kw . '%');
            });
        }

        $orders = $query->order('o.id', 'desc')->paginate([
            'list_rows' => 12,
            'query'     => ['status' => $status, 'q' => $kw],
        ]);

        $items = [];
        foreach ($orders as $order) {
            $items[(int) $order['id']] = OrderItem::where('order_id', $order['id'])->select();
        }

        View::assign([
            'nav'    => 'admin',
            'title'  => '订单管理 · 后台',
            'orders' => $orders,
            'items'  => $items,
            'status' => $status,
            'kw'     => $kw,
            'total'  => $orders->total(),
            'empty'  => $orders->isEmpty(),
            'pager'  => $orders->render(),
        ]);

        return View::fetch('index');
    }

    /**
     * 订单详情
     */
    public function detail($id)
    {
        $order = Db::name('orders')->alias('o')
            ->leftJoin('users u', 'o.user_id = u.id')
            ->field('o.*, u.email, u.nickname')
            ->where('o.id', (int) $id)
            ->find();

        if (!$order) {
            flash_set('订单不存在', 'error');
            return redirect('/admin/orders');
        }

        View::assign([
            'nav'        => 'admin',
            'title'      => '订单详情 · 后台',
            'order'      => $order,
            'orderItems' => OrderItem::where('order_id', $order['id'])->select(),
        ]);

        return View::fetch('detail');
    }

    /**
     * 发货：已付款 → 已发货
     */
    public function ship($id)
    {
        return $this->transition((int) $id, 'paid', 'shipped', '已发货');
    }

    /**
     * 设为完成：已发货 → 已完成
     */
    public function complete($id)
    {
        return $this->transition((int) $id, 'shipped', 'done', '订单已完成');
    }

    /**
     * 后台取消：待付款 / 已付款 → 已取消，回补库存
     */
    public function cancel($id)
    {
        $order = OrderModel::find((int) $id);
        if ($order === null) {
            flash_set('订单不存在', 'error');
            return redirect('/admin/orders');
        }
        if (!in_array($order['status'], ['pending', 'paid'], true)) {
            flash_set('当前状态不能取消', 'error');
            return redirect('/admin/orders/' . $order['id']);
        }

        Db::startTrans();
        try {
            $order->save(['status' => 'cancelled']);
            ShopOrder::restoreStock($order);
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            flash_set('取消失败：' . $e->getMessage(), 'error');
            return redirect('/admin/orders/' . $order['id']);
        }
        flash_set('订单已取消，库存已回补');

        return redirect('/admin/orders/' . $order['id']);
    }

    private function transition(int $id, string $from, string $to, string $okText)
    {
        $order = OrderModel::find($id);
        if ($order === null) {
            flash_set('订单不存在', 'error');
            return redirect('/admin/orders');
        }
        if ($order['status'] !== $from) {
            flash_set('当前状态不能执行该操作', 'error');
            return redirect('/admin/orders/' . $order['id']);
        }

        $order->save(['status' => $to]);
        flash_set($okText);

        return redirect('/admin/orders/' . $order['id']);
    }
}
