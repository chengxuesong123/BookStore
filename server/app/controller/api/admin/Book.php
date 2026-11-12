<?php
declare(strict_types=1);

namespace app\controller\api\admin;

use app\controller\api\ApiBase;
use app\exception\ApiException;
use app\model\Book as BookModel;
use app\model\CartItem;
use app\model\Category;

class Book extends ApiBase
{
    public function index()
    {
        $this->requireAdmin();
        $kw = trim((string) $this->request->get('q', ''));
        $page = max(1, (int) $this->request->get('page', 1));
        $size = min(50, max(1, (int) $this->request->get('page_size', 12)));

        $query = BookModel::withCategory();
        if ($kw !== '') {
            $query->whereLike('b.title', '%' . $kw . '%');
        }

        $books = $query->order('b.id', 'desc')->paginate(['list_rows' => $size, 'page' => $page, 'query' => []]);

        return $this->ok([
            'list'      => array_map(fn($b) => $this->bookArray($b), $books->items()),
            'total'     => (int) $books->total(),
            'page'      => (int) $books->currentPage(),
            'page_size' => (int) $books->listRows(),
        ]);
    }

    public function show($id)
    {
        $this->requireAdmin();
        $book = BookModel::withCategory()->where('b.id', (int) $id)->find();
        if ($book === null) {
            throw new ApiException(40400, '图书不存在', 404);
        }

        return $this->ok(['book' => $this->bookArray($book)]);
    }

    public function store()
    {
        $this->requireAdmin();
        [$data, $errors] = $this->collect();
        if ($errors) {
            throw new ApiException(42200, (string) reset($errors), 422, ['errors' => $errors]);
        }

        $book = BookModel::create($data);

        return $this->ok(['book' => $this->bookArray(BookModel::withCategory()->where('b.id', $book['id'])->find())], '图书已新增');
    }

    public function update($id)
    {
        $this->requireAdmin();
        $book = BookModel::find((int) $id);
        if ($book === null) {
            throw new ApiException(40400, '图书不存在', 404);
        }

        [$data, $errors] = $this->collect();
        if ($errors) {
            throw new ApiException(42200, (string) reset($errors), 422, ['errors' => $errors]);
        }

        $book->save($data);

        return $this->ok(['book' => $this->bookArray(BookModel::withCategory()->where('b.id', $book['id'])->find())], '图书已更新');
    }

    public function status($id)
    {
        $this->requireAdmin();
        $book = BookModel::find((int) $id);
        if ($book === null) {
            throw new ApiException(40400, '图书不存在', 404);
        }

        $next = $book['status'] === 'on' ? 'off' : 'on';
        $book->save(['status' => $next]);

        return $this->ok(['book' => $this->bookArray(BookModel::withCategory()->where('b.id', $book['id'])->find())], $next === 'on' ? '已上架' : '已下架');
    }

    public function delete($id)
    {
        $this->requireAdmin();
        $book = BookModel::find((int) $id);
        if ($book === null) {
            throw new ApiException(40400, '图书不存在', 404);
        }

        $title = (string) $book['title'];
        CartItem::where('book_id', $book['id'])->delete();
        $book->delete();

        return $this->ok(null, '已删除：' . $title);
    }

    /**
     * 收集并校验表单
     * @return array{0:array,1:array}
     */
    private function collect(): array
    {
        $input = $this->body();

        $data = [
            'category_id'    => (int) ($input['category_id'] ?? 0),
            'title'          => trim((string) ($input['title'] ?? '')),
            'author'         => trim((string) ($input['author'] ?? '')),
            'publisher'      => trim((string) ($input['publisher'] ?? '')),
            'price'          => (float) ($input['price'] ?? 0),
            'original_price' => (float) ($input['original_price'] ?? 0),
            'stock'          => (int) ($input['stock'] ?? 0),
            'cover'          => trim((string) ($input['cover'] ?? '')),
            'intro'          => trim((string) ($input['intro'] ?? '')),
            'tags'           => trim((string) ($input['tags'] ?? '')),
            'status'         => (string) ($input['status'] ?? 'on'),
        ];

        $errors = [];
        if ($data['title'] === '' || mb_strlen($data['title']) > 120) {
            $errors['title'] = '书名必填，且不超过 120 字';
        }
        if ($data['category_id'] <= 0 || Category::find($data['category_id']) === null) {
            $errors['category_id'] = '请选择有效分类';
        }
        if ($data['price'] <= 0) {
            $errors['price'] = '现价必须大于 0';
        }
        if ($data['original_price'] < 0) {
            $errors['original_price'] = '原价不能为负';
        }
        if ($data['stock'] < 0) {
            $errors['stock'] = '库存不能为负';
        }
        if (!in_array($data['status'], ['on', 'off'], true)) {
            $errors['status'] = '状态不合法';
        }
        if (mb_strlen($data['author']) > 80 || mb_strlen($data['publisher']) > 80) {
            $errors['author'] = '作者 / 出版社不超过 80 字';
        }
        if (mb_strlen($data['tags']) > 120) {
            $errors['tags'] = '标签不超过 120 字';
        }
        if ($data['cover'] === '') {
            $data['cover'] = 'linear-gradient(150deg, #3d4f6b, #263349)';
        }

        return [$data, $errors];
    }
}
