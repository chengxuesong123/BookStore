<?php
declare(strict_types=1);

namespace app\controller;

use app\BaseController;
use app\model\Book as BookModel;
use app\model\Category;
use think\facade\View;

class Book extends BaseController
{
    /**
     * 图书列表：搜索、分类筛选、排序、分页
     */
    public function index()
    {
        $kw    = trim((string) $this->request->get('q', ''));
        $catId = (int) $this->request->get('cat', 0);
        $sort  = (string) $this->request->get('sort', 'default');

        $query = BookModel::withCategory()->where('b.status', 'on');

        if ($catId > 0) {
            $query->where('b.category_id', $catId);
        }

        if ($kw !== '') {
            $query->where(function ($q) use ($kw) {
                $q->whereLike('b.title', '%' . $kw . '%')
                    ->whereOr('b.author', 'like', '%' . $kw . '%')
                    ->whereOr('b.publisher', 'like', '%' . $kw . '%');
            });
        }

        if ($sort === 'price-asc') {
            $query->order('b.price', 'asc');
        } elseif ($sort === 'price-desc') {
            $query->order('b.price', 'desc');
        } else {
            $query->order('b.id', 'desc');
        }

        $books = $query->paginate([
            'list_rows' => 8,
            'query'     => ['q' => $kw, 'cat' => $catId > 0 ? $catId : '', 'sort' => $sort],
        ]);

        View::assign([
            'nav'        => '/books',
            'title'      => '全部图书 · 墨屿书屋',
            'books'      => $books,
            'pager'      => $books->render(),
            'empty'      => $books->isEmpty(),
            'total'      => $books->total(),
            'categories' => Category::order('sort', 'asc')->select(),
            'kw'         => $kw,
            'catId'      => $catId,
            'sort'       => $sort,
        ]);

        return View::fetch('book/index');
    }

    /**
     * 图书详情
     */
    public function detail($id)
    {
        $book = BookModel::withCategory()->where('b.id', (int) $id)->find();

        if ($book === null) {
            throw new \think\exception\HttpException(404, '图书不存在');
        }

        $related = BookModel::withCategory()
            ->where('b.status', 'on')
            ->where('b.category_id', $book['category_id'])
            ->where('b.id', '<>', $book['id'])
            ->order('b.id', 'desc')
            ->limit(4)
            ->select();

        View::assign([
            'nav'     => '/books',
            'title'   => $book['title'] . ' · 墨屿书屋',
            'book'    => $book,
            'related' => $related,
            'tagList'  => $book['tags'] === '' ? [] : explode(',', (string) $book['tags']),
            'tagsText' => str_replace(',', ' / ', (string) $book['tags']),
        ]);

        return View::fetch('book/detail');
    }
}
