<?php
declare(strict_types=1);

namespace app\controller;

use app\BaseController;
use app\model\Book;
use app\model\Category;
use think\facade\View;

class Index extends BaseController
{
    public function index()
    {
        $categories = Category::order('sort', 'asc')->select();

        $picks = Book::withCategory()
            ->where('b.status', 'on')
            ->order('b.id', 'desc')
            ->limit(8)
            ->select();

        $hot = Book::withCategory()
            ->where('b.status', 'on')
            ->order('b.stock', 'desc')
            ->limit(8)
            ->select();

        $promos = [
            ['cls' => 'promo-mint', 'badge' => '热销', 'title' => '治愈系书架', 'desc' => '把日子过慢一点，从一本小书开始。', 'action' => '去逛逛'],
            ['cls' => 'promo-peach', 'badge' => '新到', 'title' => '历史也可以很好看', 'desc' => '从万历十五年到明朝那些事儿。', 'action' => '看看历史'],
            ['cls' => 'promo-sky', 'badge' => '精选', 'title' => '程序员的枕边书', 'desc' => 'CSAPP、整洁之道，一本都别少。', 'action' => '挑技术书'],
        ];

        foreach ($promos as $i => &$promo) {
            $cat           = $categories[$i] ?? null;
            $promo['cat']  = $cat;
            $promo['book'] = $cat ? Book::where('category_id', $cat['id'])->where('status', 'on')->find() : null;
        }
        unset($promo);

        View::assign([
            'nav'        => '/',
            'categories' => $categories,
            'picks'      => $picks,
            'hot'        => $hot,
            'promos'     => $promos,
            'floats'     => [$picks[2] ?? null, $picks[4] ?? null, $picks[0] ?? null],
        ]);

        return View::fetch();
    }
}
