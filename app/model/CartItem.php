<?php
declare(strict_types=1);

namespace app\model;

use think\Model;

/**
 * 购物车项（仅登录用户落库，游客走 session）
 */
class CartItem extends Model
{
    protected $name = 'cart_items';

    protected $autoWriteTimestamp = false;

    public function book()
    {
        return $this->belongsTo(Book::class, 'book_id');
    }
}
