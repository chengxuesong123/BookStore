<?php
declare(strict_types=1);

namespace app\controller;

use app\BaseController;
use app\model\Book as BookModel;
use app\model\Order as OrderModel;
use app\model\OrderItem;
use app\service\CartService;
use think\facade\Db;
use think\facade\Session;
use think\facade\View;

class Order extends BaseController
{
    /**
     * 结算页
     */
    public function checkout()
    {
        $user = current_user();
        if ($user === null) {
            return redirect('/login?next=%2Fcheckout');
        }

        $items = CartService::items();
        if (!$items) {
            flash_set('购物车是空的，先挑几本书吧', 'error');
            return redirect('/cart');
        }

        View::assign([
            'nav'    => '/cart',
            'title'  => '确认订单 · 墨屿书屋',
            'items'  => $items,
            'totals' => CartService::totals($items),
            'user'   => $user,
            'prefillReceiver' => (string) ($oldArr['receiver'] ?? $user['nickname']),
        ]);

        return View::fetch('order/checkout');
    }

    /**
     * 提交订单：事务内条件扣库存 + 写订单与快照
     */
    public function create()
    {
        $user = current_user();
        if ($user === null) {
            return redirect('/login?next=%2Fcheckout');
        }

        $receiver = trim((string) $this->request->post('receiver', ''));
        $phone    = trim((string) $this->request->post('phone', ''));
        $address  = trim((string) $this->request->post('address', ''));
        $remark   = trim((string) $this->request->post('remark', ''));

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

        $items = CartService::items();
        if (!$items) {
            flash_set('购物车是空的，无法下单', 'error');
            return redirect('/cart');
        }

        if ($errors) {
            Session::set('old', [
                'receiver' => $receiver,
                'phone'    => $phone,
                'address'  => $address,
                'remark'   => $remark,
            ]);
            Session::set('errors', $errors);
            flash_set((string) reset($errors), 'error');

            return redirect('/checkout');
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
                    throw new \RuntimeException('《' . $line['book']['title'] . '》库存不足，请调整数量');
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
        } catch (\Throwable $e) {
            Db::rollback();
            flash_set($e->getMessage(), 'error');

            return redirect('/cart');
        }

        CartService::clear();
        flash_set('下单成功，订单号 ' . $order['order_no']);

        return redirect('/order/' . $order['id']);
    }

    /**
     * 我的订单
     */
    public function index()
    {
        $user = current_user();
        if ($user === null) {
            return redirect('/login?next=%2Forders');
        }

        $orders = OrderModel::where('user_id', (int) $user['id'])
            ->order('id', 'desc')
            ->paginate(['list_rows' => 10, 'query' => []]);

        $list = [];
        foreach ($orders as $order) {
            $list[] = [
                'order' => $order,
                'items' => OrderItem::where('order_id', $order['id'])->select(),
            ];
        }

        View::assign([
            'nav'    => '/orders',
            'title'  => '我的订单 · 墨屿书屋',
            'list'   => $list,
            'total'  => $orders->total(),
            'empty'  => $orders->isEmpty(),
            'pager'  => $orders->render(),
        ]);

        return View::fetch('order/index');
    }

    /**
     * 订单详情（校验归属）
     */
    public function detail($id)
    {
        $user = current_user();
        if ($user === null) {
            return redirect('/login?next=%2Forders');
        }

        $order = OrderModel::where('id', (int) $id)->find();
        if ($order === null || (int) $order['user_id'] !== (int) $user['id']) {
            throw new \think\exception\HttpException(404, '订单不存在');
        }

        $orderItems = OrderItem::where('order_id', $order['id'])->select();

        View::assign([
            'nav'        => '/orders',
            'title'      => '订单详情 · 墨屿书屋',
            'order'      => $order,
            'orderItems' => $orderItems,
            'steps'      => ['pending', 'paid', 'shipped', 'done'],
            'stepIndex'  => array_search($order['status'], ['pending', 'paid', 'shipped', 'done'], true),
        ]);

        return View::fetch('order/detail');
    }

    /**
     * 模拟付款：待付款 → 已付款
     */
    public function pay($id)
    {
        $order = $this->findOwnOrder((int) $id);
        if ($order === null) {
            throw new \think\exception\HttpException(404, '订单不存在');
        }
        if ($order['status'] !== 'pending') {
            flash_set('当前状态不能付款', 'error');
            return redirect('/order/' . $order['id']);
        }

        $order->save(['status' => 'paid']);
        flash_set('付款成功（模拟），等待发货');

        return redirect('/order/' . $order['id']);
    }

    /**
     * 取消订单：待付款 → 已取消，回补库存
     */
    public function cancel($id)
    {
        $order = $this->findOwnOrder((int) $id);
        if ($order === null) {
            throw new \think\exception\HttpException(404, '订单不存在');
        }
        if ($order['status'] !== 'pending') {
            flash_set('只有待付款订单可以取消', 'error');
            return redirect('/order/' . $order['id']);
        }

        Db::startTrans();
        try {
            $order->save(['status' => 'cancelled']);
            self::restoreStock($order);
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            flash_set('取消失败，请稍后再试', 'error');
            return redirect('/order/' . $order['id']);
        }
        flash_set('订单已取消，库存已回补');

        return redirect('/order/' . $order['id']);
    }

    /**
     * 确认收货：已发货 → 已完成
     */
    public function receive($id)
    {
        $order = $this->findOwnOrder((int) $id);
        if ($order === null) {
            throw new \think\exception\HttpException(404, '订单不存在');
        }
        if ($order['status'] !== 'shipped') {
            flash_set('当前状态不能确认收货', 'error');
            return redirect('/order/' . $order['id']);
        }

        $order->save(['status' => 'done']);
        flash_set('已确认收货，交易完成');

        return redirect('/order/' . $order['id']);
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

    private function findOwnOrder(int $id): ?OrderModel
    {
        $user = current_user();
        if ($user === null) {
            return null;
        }

        $order = OrderModel::where('id', $id)->find();
        if ($order === null || (int) $order['user_id'] !== (int) $user['id']) {
            return null;
        }

        return $order;
    }

    private function makeOrderNo(): string
    {
        do {
            $no = 'MY' . date('YmdHis') . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (OrderModel::where('order_no', $no)->find() !== null);

        return $no;
    }
}
