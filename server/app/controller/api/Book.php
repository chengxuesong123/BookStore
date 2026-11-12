<?php
declare(strict_types=1);

namespace app\controller\api;

use app\exception\ApiException;
use app\model\Book as BookModel;
use app\model\Category;

class Book extends ApiBase
{
    public function categories()
    {
        $rows = Category::order('sort', 'asc')->select();

        return $this->ok([
            'list' => array_map(fn($c) => [
                'id'   => (int) $c['id'],
                'name' => (string) $c['name'],
                'sort' => (int) $c['sort'],
            ], $rows->toArray()),
        ]);
    }

    /**
     * 图书列表：搜索、分类、排序、分页
     */
    public function index()
    {
        $kw    = trim((string) $this->request->get('q', ''));
        $catId = (int) $this->request->get('cat', 0);
        $sort  = (string) $this->request->get('sort', 'default');
        $page  = max(1, (int) $this->request->get('page', 1));
        $size  = min(48, max(1, (int) $this->request->get('page_size', 8)));

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
        } elseif ($sort === 'stock') {
            $query->order('b.stock', 'desc')->order('b.id', 'desc');
        } else {
            $query->order('b.id', 'desc');
        }

        $books = $query->paginate(['list_rows' => $size, 'page' => $page, 'query' => []]);

        return $this->ok([
            'list'      => array_map(fn($b) => $this->bookArray($b), $books->items()),
            'total'     => (int) $books->total(),
            'page'      => (int) $books->currentPage(),
            'page_size' => (int) $books->listRows(),
        ]);
    }

    public function detail($id)
    {
        $book = BookModel::withCategory()->where('b.id', (int) $id)->where('b.status', 'on')->find();
        if ($book === null) {
            throw new ApiException(40400, '图书不存在或已下架', 404);
        }

        $related = BookModel::withCategory()
            ->where('b.status', 'on')
            ->where('b.category_id', $book['category_id'])
            ->where('b.id', '<>', $book['id'])
            ->order('b.id', 'desc')
            ->limit(4)
            ->select();

        return $this->ok([
            'book'    => $this->bookArray($book),
            'related' => array_map(fn($b) => $this->bookArray($b), $related->toArray()),
        ]);
    }
}
