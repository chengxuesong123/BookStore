<?php
declare(strict_types=1);

namespace app\model;

use think\Model;

/**
 * 订单
 */
class Order extends Model
{
    protected $name = 'orders';

    protected $autoWriteTimestamp = false;

    public function items()
    {
        return $this->hasMany(OrderItem::class, 'order_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
