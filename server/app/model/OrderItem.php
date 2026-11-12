<?php
declare(strict_types=1);

namespace app\model;

use think\Model;

/**
 * 订单明细（书名、封面、单价都是下单时的快照）
 */
class OrderItem extends Model
{
    protected $name = 'order_items';

    protected $autoWriteTimestamp = false;

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }
}
