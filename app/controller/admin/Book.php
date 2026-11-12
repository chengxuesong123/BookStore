<?php
declare(strict_types=1);

namespace app\controller\admin;

use app\BaseController;
use app\model\Book as BookModel;
use app\model\CartItem;
use app\model\Category;
use think\facade\Session;
use think\facade\View;

class Book extends BaseController
{
    /**
     * 图书列表（含下架）
     */
    public function index()
    {
        $kw = trim((string) $this->request->get('q', ''));

        $query = BookModel::withCategory();
        if ($kw !== '') {
            $query->whereLike('b.title', '%' . $kw . '%');
        }

        $books = $query->order('b.id', 'desc')->paginate([
            'list_rows' => 12,
            'query'     => ['q' => $kw],
        ]);

        View::assign([
            'nav'    => 'admin',
            'title'  => '图书管理 · 后台',
            'books'  => $books,
            'pager'  => $books->render(),
            'empty'  => $books->isEmpty(),
            'kw'     => $kw,
            'total'  => $books->total(),
        ]);

        return View::fetch('index');
    }

    /**
     * 新增表单
     */
    public function create()
    {
        View::assign([
            'nav'        => 'admin',
            'title'      => '新增图书 · 后台',
            'book'       => null,
            'categories' => Category::order('sort', 'asc')->select(),
            'action'     => '/admin/books/save',
        ]);

        return View::fetch('form');
    }

    /**
     * 保存新增
     */
    public function save()
    {
        [$data, $errors, $old] = $this->collect();

        if ($errors) {
            return $this->backWithErrors('/admin/books/create', $errors, $old);
        }

        BookModel::create($data);
        flash_set('图书已新增：' . $data['title']);

        return redirect('/admin/books');
    }

    /**
     * 编辑表单
     */
    public function edit($id)
    {
        $book = BookModel::find((int) $id);
        if ($book === null) {
            flash_set('图书不存在', 'error');
            return redirect('/admin/books');
        }

        View::assign([
            'nav'        => 'admin',
            'title'      => '编辑图书 · 后台',
            'book'       => $book,
            'categories' => Category::order('sort', 'asc')->select(),
            'action'     => '/admin/books/' . $book['id'] . '/update',
        ]);

        return View::fetch('form');
    }

    /**
     * 保存编辑
     */
    public function update($id)
    {
        $book = BookModel::find((int) $id);
        if ($book === null) {
            flash_set('图书不存在', 'error');
            return redirect('/admin/books');
        }

        [$data, $errors, $old] = $this->collect();

        if ($errors) {
            return $this->backWithErrors('/admin/books/' . $book['id'] . '/edit', $errors, $old);
        }

        $book->save($data);
        flash_set('图书已更新：' . $data['title']);

        return redirect('/admin/books');
    }

    /**
     * 上架 / 下架
     */
    public function toggle($id)
    {
        $book = BookModel::find((int) $id);
        if ($book === null) {
            flash_set('图书不存在', 'error');
            return redirect('/admin/books');
        }

        $next = $book['status'] === 'on' ? 'off' : 'on';
        $book->save(['status' => $next]);
        flash_set($next === 'on' ? '已上架：' . $book['title'] : '已下架：' . $book['title']);

        return redirect('/admin/books');
    }

    /**
     * 删除（先清购物车引用，历史订单用快照不受影响）
     */
    public function delete($id)
    {
        $book = BookModel::find((int) $id);
        if ($book === null) {
            flash_set('图书不存在', 'error');
            return redirect('/admin/books');
        }

        $title = (string) $book['title'];
        CartItem::where('book_id', $book['id'])->delete();
        $book->delete();
        flash_set('已删除：' . $title);

        return redirect('/admin/books');
    }

    /**
     * 收集并校验表单
     * @return array{0:array,1:array,2:array}
     */
    private function collect(): array
    {
        $post = [
            'category_id'    => (int) $this->request->post('category_id', 0),
            'title'          => trim((string) $this->request->post('title', '')),
            'author'         => trim((string) $this->request->post('author', '')),
            'publisher'      => trim((string) $this->request->post('publisher', '')),
            'price'          => (float) $this->request->post('price', 0),
            'original_price' => (float) $this->request->post('original_price', 0),
            'stock'          => (int) $this->request->post('stock', 0),
            'cover'          => trim((string) $this->request->post('cover', '')),
            'intro'          => trim((string) $this->request->post('intro', '')),
            'tags'           => trim((string) $this->request->post('tags', '')),
            'status'         => (string) $this->request->post('status', 'on'),
        ];

        $errors = [];
        if ($post['title'] === '' || mb_strlen($post['title']) > 120) {
            $errors['title'] = '书名必填，且不超过 120 字';
        }
        if ($post['category_id'] <= 0 || Category::find($post['category_id']) === null) {
            $errors['category_id'] = '请选择有效分类';
        }
        if ($post['price'] <= 0) {
            $errors['price'] = '现价必须大于 0';
        }
        if ($post['original_price'] < 0) {
            $errors['original_price'] = '原价不能为负';
        }
        if ($post['stock'] < 0) {
            $errors['stock'] = '库存不能为负';
        }
        if (!in_array($post['status'], ['on', 'off'], true)) {
            $errors['status'] = '状态不合法';
        }
        if (mb_strlen($post['author']) > 80 || mb_strlen($post['publisher']) > 80) {
            $errors['author'] = '作者 / 出版社不超过 80 字';
        }
        if (mb_strlen($post['tags']) > 120) {
            $errors['tags'] = '标签不超过 120 字';
        }

        // 没填封面时给一个默认渐变，列表不至于空白
        if ($post['cover'] === '') {
            $post['cover'] = 'linear-gradient(150deg, #3d4f6b, #263349)';
        }

        return [$post, $errors, $post];
    }

    private function backWithErrors(string $path, array $errors, array $old)
    {
        Session::set('old', $old);
        Session::set('errors', $errors);
        flash_set((string) reset($errors), 'error');

        return redirect($path);
    }
}
