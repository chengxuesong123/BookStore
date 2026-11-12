<?php
declare(strict_types=1);

namespace app\controller\api;

use app\BaseController;
use app\exception\ApiException;
use app\model\Book as BookModel;
use app\model\User;
use think\facade\Session;

/**
 * API 控制器基类：统一成功响应与当前用户
 */
abstract class ApiBase extends BaseController
{
    protected function ok($data = null, string $msg = 'ok')
    {
        return json(['code' => 0, 'msg' => $msg, 'data' => $data]);
    }

    protected function user(): ?array
    {
        $user = Session::get('user');

        return $user ?: null;
    }

    protected function requireUser(): array
    {
        $user = $this->user();
        if ($user === null) {
            throw new ApiException(40100, '请先登录', 401);
        }

        return $user;
    }

    protected function requireAdmin(): array
    {
        $user = $this->requireUser();
        if (($user['role'] ?? '') !== 'admin') {
            throw new ApiException(40300, '当前账号没有后台权限', 403);
        }

        return $user;
    }

    /**
     * 读取请求体：优先 JSON，其次表单
     */
    protected function body(): array
    {
        // TP8 会把 JSON 请求体解析进 post（$_POST 为空时用 inputData）
        $post = $this->request->post(false);
        if (is_array($post) && $post) {
            return $post;
        }

        $param = $this->request->param();
        if (is_array($param) && $param) {
            // 只保留请求体里的字段，避免同名 query 干扰
            unset($param['_token']);

            return $param;
        }

        return [];
    }

    /**
     * 图书输出结构（数值字段转成 JSON 数字）
     */
    protected function bookArray($book): array
    {
        if (is_array($book)) {
            $row = $book;
        } else {
            $row = $book->toArray();
        }

        return [
            'id'             => (int) $row['id'],
            'title'          => (string) $row['title'],
            'author'         => (string) ($row['author'] ?? ''),
            'publisher'      => (string) ($row['publisher'] ?? ''),
            'category_id'    => (int) $row['category_id'],
            'category_name'  => (string) ($row['category_name'] ?? ''),
            'price'          => (float) $row['price'],
            'original_price' => (float) $row['original_price'],
            'stock'          => (int) $row['stock'],
            'cover'          => (string) $row['cover'],
            'intro'          => (string) ($row['intro'] ?? ''),
            'tags'           => (string) ($row['tags'] ?? ''),
            'tag_list'       => array_values(array_filter(array_map('trim', explode(',', (string) ($row['tags'] ?? ''))))),
            'status'         => (string) $row['status'],
            'created_at'     => (string) ($row['created_at'] ?? ''),
        ];
    }
}
