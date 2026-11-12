<?php
declare(strict_types=1);

namespace app\controller\api;

use app\exception\ApiException;
use app\model\User as UserModel;
use app\service\CartService;
use think\facade\Session;

class Auth extends ApiBase
{
    /**
     * 注册：只产生 customer
     */
    public function register()
    {
        $email    = trim((string) ($this->body()['email'] ?? ''));
        $nickname = trim((string) ($this->body()['nickname'] ?? ''));
        $password = (string) ($this->body()['password'] ?? '');
        $confirm  = (string) ($this->body()['confirm'] ?? '');

        $errors = [];
        if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) {
            $errors['email'] = '请输入正确的邮箱地址';
        }
        if (mb_strlen($nickname) < 2 || mb_strlen($nickname) > 20) {
            $errors['nickname'] = '昵称需要 2–20 个字';
        }
        if (strlen($password) < 6) {
            $errors['password'] = '密码至少 6 位';
        }
        if ($password !== $confirm) {
            $errors['confirm'] = '两次输入的密码不一致';
        }
        if (UserModel::where('email', $email)->find() !== null) {
            $errors['email'] = '这个邮箱已经注册过了';
        }
        if ($errors) {
            throw new ApiException(42200, (string) reset($errors), 422, ['errors' => $errors]);
        }

        $user = UserModel::create([
            'email'         => $email,
            'nickname'      => $nickname,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role'          => 'customer',
        ]);

        Session::set('user', $user->toSession());
        CartService::mergeGuestCart((int) $user['id']);

        return $this->ok(['user' => $this->userPayload($user)], '注册成功');
    }

    /**
     * 登录：admin 返回 redirect=/admin
     */
    public function login()
    {
        $email    = trim((string) ($this->body()['email'] ?? ''));
        $password = (string) ($this->body()['password'] ?? '');

        $errors = [];
        if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) {
            $errors['email'] = '请输入正确的邮箱地址';
        }
        if ($password === '') {
            $errors['password'] = '请输入密码';
        }
        if ($errors) {
            throw new ApiException(42200, (string) reset($errors), 422, ['errors' => $errors]);
        }

        $user = UserModel::where('email', $email)->find();
        if ($user === null || !password_verify($password, (string) $user->getAttr('password_hash'))) {
            throw new ApiException(42200, '邮箱或密码不正确', 422, ['errors' => ['password' => '邮箱或密码不正确']]);
        }

        Session::set('user', $user->toSession());
        CartService::mergeGuestCart((int) $user['id']);

        return $this->ok([
            'user'     => $this->userPayload($user),
            'redirect' => $user->isAdmin() ? '/admin' : '/',
        ], '登录成功');
    }

    public function logout()
    {
        Session::delete('user');

        return $this->ok(null, '已退出登录');
    }

    public function me()
    {
        $user = $this->user();
        if ($user === null) {
            throw new ApiException(40100, '未登录', 401);
        }

        return $this->ok(['user' => $this->userPayload(UserModel::find((int) $user['id']))]);
    }

    public function csrf()
    {
        return $this->ok(['token' => csrf_token()]);
    }

    private function userPayload(UserModel $user): array
    {
        return [
            'id'         => (int) $user['id'],
            'email'      => (string) $user['email'],
            'nickname'   => (string) $user['nickname'],
            'role'       => (string) $user['role'],
            'avatar'     => (string) ($user['avatar'] ?? ''),
            'created_at' => (string) ($user['created_at'] ?? ''),
        ];
    }
}
