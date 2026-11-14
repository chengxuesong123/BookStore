<?php
declare(strict_types=1);

namespace app\controller\api\admin;

use app\controller\api\ApiBase;
use app\exception\ApiException;
use app\model\Order;
use app\model\User as UserModel;

class User extends ApiBase
{
    /**
     * 用户列表（含订单数）
     */
    public function index()
    {
        $this->requireAdmin();
        $kw   = trim((string) $this->request->get('q', ''));
        $page = max(1, (int) $this->request->get('page', 1));
        $size = min(50, max(1, (int) $this->request->get('page_size', 15)));

        $query = UserModel::field('id,email,nickname,role,avatar,created_at');
        if ($kw !== '') {
            $query->where(function ($q) use ($kw) {
                $q->whereLike('email', '%' . $kw . '%')->whereOr('nickname', 'like', '%' . $kw . '%');
            });
        }

        $users = $query->order('id', 'asc')->paginate(['list_rows' => $size, 'page' => $page, 'query' => []]);

        $list = [];
        foreach ($users->items() as $u) {
            $list[] = $this->userArray($u, (int) Order::where('user_id', $u['id'])->count());
        }

        return $this->ok([
            'list'      => $list,
            'total'     => (int) $users->total(),
            'page'      => (int) $users->currentPage(),
            'page_size' => (int) $users->listRows(),
        ]);
    }

    /**
     * 修改用户：昵称 / 角色 / 重置密码
     */
    public function update($id)
    {
        $me = $this->requireAdmin();
        $user = UserModel::find((int) $id);
        if ($user === null) {
            throw new ApiException(40400, '用户不存在', 404);
        }

        $input = $this->body();
        $nickname = trim((string) ($input['nickname'] ?? $user['nickname']));
        $role = (string) ($input['role'] ?? $user['role']);
        $password = (string) ($input['password'] ?? '');

        $errors = [];
        if (mb_strlen($nickname) < 2 || mb_strlen($nickname) > 20) {
            $errors['nickname'] = '昵称需要 2–20 个字';
        }
        if (!in_array($role, ['customer', 'admin'], true)) {
            $errors['role'] = '角色不合法';
        }
        if ($password !== '' && strlen($password) < 6) {
            $errors['password'] = '密码至少 6 位';
        }
        if ((int) $user['id'] === (int) $me['id'] && $role !== (string) $user['role']) {
            $errors['role'] = '不能修改自己的角色';
        }
        if ($user['role'] === 'admin' && $role !== 'admin' && UserModel::where('role', 'admin')->count() <= 1) {
            $errors['role'] = '至少要保留一个管理员';
        }
        if ($errors) {
            throw new ApiException(42200, (string) reset($errors), 422, ['errors' => $errors]);
        }

        $data = ['nickname' => $nickname, 'role' => $role];
        if ($password !== '') {
            $data['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }
        $user->save($data);

        return $this->ok([
            'user' => $this->userArray(UserModel::find((int) $user['id']), (int) Order::where('user_id', $user['id'])->count()),
        ], '用户已更新');
    }

    private function userArray(UserModel $user, int $orderCount = 0): array
    {
        return [
            'id'          => (int) $user['id'],
            'email'       => (string) $user['email'],
            'nickname'    => (string) $user['nickname'],
            'role'        => (string) $user['role'],
            'avatar'      => (string) ($user['avatar'] ?? ''),
            'created_at'  => (string) ($user['created_at'] ?? ''),
            'order_count' => $orderCount,
        ];
    }
}
