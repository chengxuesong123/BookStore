<?php
declare(strict_types=1);

namespace app\model;

use think\Model;

/**
 * 图书
 */
class Book extends Model
{
    protected $name = 'books';

    // 表里用的是 created_at，模型默认找 create_time，这里关掉自动时间戳
    protected $autoWriteTimestamp = false;

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * 在售图书
     */
    public function scopeOnSale($query)
    {
        $query->where('status', 'on');
    }

    /**
     * 带上分类名（列表页一次查完，避免 N+1）
     */
    public static function withCategory()
    {
        return static::alias('b')
            ->leftJoin('categories c', 'c.id = b.category_id')
            ->field('b.*, c.name AS category_name');
    }

    /**
     * 标签数组
     */
    public function getTagListAttr($value, $data): array
    {
        $tags = (string) ($data['tags'] ?? '');
        return $tags === '' ? [] : array_values(array_filter(explode(',', $tags)));
    }
}
