<?php
declare(strict_types=1);

namespace app\controller\admin;

use app\BaseController;
use app\model\Book;
use app\model\Category as CategoryModel;
use think\facade\View;

class Category extends BaseController
{
    public function index()
    {
        $categories = CategoryModel::order('sort', 'asc')->select();

        $counts = [];
        foreach ($categories as $c) {
            $counts[(int) $c['id']] = Book::where('category_id', $c['id'])->count();
        }

        View::assign([
            'nav'        => 'admin',
            'title'      => '分类管理 · 后台',
            'categories' => $categories,
            'counts'     => $counts,
            'count'      => count($categories),
        ]);

        return View::fetch('index');
    }

    /**
     * 新增或重命名分类
     */
    public function save()
    {
        $id   = (int) $this->request->post('id', 0);
        $name = trim((string) $this->request->post('name', ''));
        $sort = (int) $this->request->post('sort', 0);

        if ($name === '' || mb_strlen($name) > 30) {
            flash_set('分类名必填，且不超过 30 字', 'error');
            return redirect('/admin/categories');
        }

        $exists = CategoryModel::where('name', $name);
        if ($id > 0) {
            $exists->where('id', '<>', $id);
        }
        if ($exists->find() !== null) {
            flash_set('分类名已存在', 'error');
            return redirect('/admin/categories');
        }

        if ($id > 0) {
            $category = CategoryModel::find($id);
            if ($category === null) {
                flash_set('分类不存在', 'error');
                return redirect('/admin/categories');
            }
            $category->save(['name' => $name, 'sort' => $sort]);
            flash_set('分类已更新：' . $name);
        } else {
            CategoryModel::create(['name' => $name, 'sort' => $sort]);
            flash_set('已新增分类：' . $name);
        }

        return redirect('/admin/categories');
    }

    /**
     * 删除分类：分类下还有书就拒绝
     */
    public function delete($id)
    {
        $category = CategoryModel::find((int) $id);
        if ($category === null) {
            flash_set('分类不存在', 'error');
            return redirect('/admin/categories');
        }

        $used = Book::where('category_id', $category['id'])->count();
        if ($used > 0) {
            flash_set('该分类下还有 ' . $used . ' 本书，先处理图书再删', 'error');
            return redirect('/admin/categories');
        }

        $name = (string) $category['name'];
        $category->delete();
        flash_set('已删除分类：' . $name);

        return redirect('/admin/categories');
    }
}
