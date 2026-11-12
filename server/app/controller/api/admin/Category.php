<?php
declare(strict_types=1);

namespace app\controller\api\admin;

use app\controller\api\ApiBase;
use app\exception\ApiException;
use app\model\Book as BookModel;
use app\model\Category as CategoryModel;

class Category extends ApiBase
{
    public function index()
    {
        $this->requireAdmin();
        $rows = CategoryModel::order('sort', 'asc')->select();

        $list = [];
        foreach ($rows as $c) {
            $list[] = [
                'id'        => (int) $c['id'],
                'name'      => (string) $c['name'],
                'sort'      => (int) $c['sort'],
                'book_count'=> (int) BookModel::where('category_id', $c['id'])->count(),
            ];
        }

        return $this->ok(['list' => $list]);
    }

    public function store()
    {
        $this->requireAdmin();
        $input = $this->body();
        $name = trim((string) ($input['name'] ?? ''));
        $sort = (int) ($input['sort'] ?? 0);

        $this->validateName($name);
        if (CategoryModel::where('name', $name)->find() !== null) {
            throw new ApiException(42200, '分类名已存在', 422, ['errors' => ['name' => '分类名已存在']]);
        }

        $category = CategoryModel::create(['name' => $name, 'sort' => $sort]);

        return $this->ok(['category' => ['id' => (int) $category['id'], 'name' => $name, 'sort' => $sort, 'book_count' => 0]], '分类已新增');
    }

    public function update($id)
    {
        $this->requireAdmin();
        $category = CategoryModel::find((int) $id);
        if ($category === null) {
            throw new ApiException(40400, '分类不存在', 404);
        }

        $input = $this->body();
        $name = trim((string) ($input['name'] ?? ''));
        $sort = (int) ($input['sort'] ?? 0);
        $this->validateName($name);

        $exists = CategoryModel::where('name', $name)->where('id', '<>', $category['id'])->find();
        if ($exists !== null) {
            throw new ApiException(42200, '分类名已存在', 422, ['errors' => ['name' => '分类名已存在']]);
        }

        $category->save(['name' => $name, 'sort' => $sort]);

        return $this->ok(['category' => ['id' => (int) $category['id'], 'name' => $name, 'sort' => $sort, 'book_count' => (int) BookModel::where('category_id', $category['id'])->count()]], '分类已更新');
    }

    public function delete($id)
    {
        $this->requireAdmin();
        $category = CategoryModel::find((int) $id);
        if ($category === null) {
            throw new ApiException(40400, '分类不存在', 404);
        }

        $used = BookModel::where('category_id', $category['id'])->count();
        if ($used > 0) {
            throw new ApiException(42200, '该分类下还有 ' . $used . ' 本书，先处理图书再删', 422);
        }

        $name = (string) $category['name'];
        $category->delete();

        return $this->ok(null, '已删除分类：' . $name);
    }

    private function validateName(string $name): void
    {
        if ($name === '' || mb_strlen($name) > 30) {
            throw new ApiException(42200, '分类名必填，且不超过 30 字', 422, ['errors' => ['name' => '分类名必填，且不超过 30 字']]);
        }
    }
}
