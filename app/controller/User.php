<?php
declare(strict_types=1);

namespace app\controller;

use app\BaseController;
use app\model\User as UserModel;
use think\facade\Session;
use think\facade\View;

class User extends BaseController
{
    /**
     * 登录页
     */
    public function loginPage()
    {
        if (current_user() !== null) {
            return redirect(is_admin() ? '/admin' : '/');
        }

        View::assign([
            'nav'       => '',
            'adminMode' => (bool) $this->request->get('admin', 0),
            'next'      => $this->safeNext((string) $this->request->get('next', '')),
        ]);

        return View::fetch('user/login');
    }

    /**
     * 登录
     */
    public function login()
    {
        $email    = strtolower(trim((string) $this->request->post('email', '')));
        $password = (string) $this->request->post('password', '');
        $next     = $this->safeNext((string) $this->request->post('next', ''));
        $adminMode = (int) $this->request->post('admin', 0) === 1;

        $errors = [];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = '请输入正确的邮箱地址';
        }
        if (strlen($password) < 6) {
            $errors['password'] = '密码至少 6 位';
        }
        if ($errors) {
            return $this->backWithErrors('/login', $errors, ['email' => $email, 'next' => $next, 'admin' => $adminMode]);
        }

        $user = UserModel::where('email', $email)->find();
        // 账号不存在与密码错误返回同一提示，避免枚举账号
        if ($user === null || !password_verify($password, (string) $user->getAttr('password_hash'))) {
            return $this->backWithErrors('/login', ['password' => '邮箱或密码不正确'], ['email' => $email, 'next' => $next, 'admin' => $adminMode]);
        }

        Session::set('user', $user->toSession());
        $this->mergeGuestCart((int) $user['id']);

        if ($user->isAdmin()) {
            flash_set('管理员登录成功，已进入后台');
            return redirect('/admin');
        }

        flash_set('登录成功，欢迎回来');
        return redirect($next !== '' ? $next : '/');
    }

    /**
     * 注册页
     */
    public function registerPage()
    {
        if (current_user() !== null) {
            return redirect('/');
        }

        View::assign([
            'nav'  => '',
            'next' => $this->safeNext((string) $this->request->get('next', '')),
        ]);

        return View::fetch('user/register');
    }

    /**
     * 注册（只产生 customer）
     */
    public function register()
    {
        $email    = strtolower(trim((string) $this->request->post('email', '')));
        $nickname = trim((string) $this->request->post('nickname', ''));
        $password = (string) $this->request->post('password', '');
        $confirm  = (string) $this->request->post('confirm', '');
        $next     = $this->safeNext((string) $this->request->post('next', ''));

        $errors = [];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = '请输入正确的邮箱地址';
        } elseif (UserModel::where('email', $email)->find() !== null) {
            $errors['email'] = '该邮箱已注册，请直接登录';
        }
        if (mb_strlen($nickname) < 2) {
            $errors['nickname'] = '昵称至少 2 个字';
        }
        if (strlen($password) < 6) {
            $errors['password'] = '密码至少 6 位';
        }
        if ($password !== $confirm) {
            $errors['confirm'] = '两次输入的密码不一致';
        }

        $old = ['email' => $email, 'nickname' => $nickname, 'next' => $next];
        if ($errors) {
            return $this->backWithErrors('/register', $errors, $old);
        }

        $user = UserModel::create([
            'email'         => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'nickname'      => $nickname,
            'role'          => 'customer',
        ]);

        Session::set('user', $user->toSession());
        $this->mergeGuestCart((int) $user['id']);
        flash_set('注册成功，已自动登录');

        return redirect($next !== '' ? $next : '/');
    }

    /**
     * 退出
     */
    public function logout()
    {
        Session::delete('user');
        flash_set('已退出登录');
        return redirect('/');
    }

    /**
     * 只允许站内相对路径，防止开放重定向
     */
    private function safeNext(string $next): string
    {
        $next = trim($next);
        if ($next === '' || $next[0] !== '/' || str_starts_with($next, '//') || str_starts_with($next, '/login')
            || str_starts_with($next, '/register') || str_starts_with($next, '/logout')) {
            return '';
        }
        return $next;
    }

    /**
     * 失败：回填输入 + 字段错误，回到指定页面
     */
    private function backWithErrors(string $path, array $errors, array $old)
    {
        Session::set('old', $old);
        Session::set('errors', $errors);
        flash_set((string) reset($errors), 'error');

        $query = '';
        if (!empty($old['next'])) {
            $query = '?next=' . urlencode((string) $old['next']);
        }
        if (!empty($old['admin'])) {
            $query .= ($query === '' ? '?' : '&') . 'admin=1';
        }

        return redirect($path . $query);
    }

    /**
     * 游客 session 购物车合并到登录用户（M4 起生效，这里留接口）
     */
    private function mergeGuestCart(int $userId): void
    {
        if (class_exists(\app\service\CartService::class)) {
            \app\service\CartService::mergeGuestCart($userId);
        }
    }
}
