<?php
declare(strict_types=1);

namespace app\model;

use think\Model;

/**
 * 单层分类
 */
class Category extends Model
{
    protected $name = 'categories';

    protected $autoWriteTimestamp = false;

    public function books()
    {
        return $this->hasMany(Book::class, 'category_id');
    }
}
