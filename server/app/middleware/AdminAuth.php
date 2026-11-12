<?php
declare(strict_types=1);

namespace app\middleware;

use Closure;
use think\facade\Session;
use think\Request;

/**
 * 后台接口鉴权：未登录 401，非管理员 403。
 * 前端隐藏入口只是体验，真正的边界在这里。
 */
class AdminAuth
{
    public function handle(Request $request, Closure $next)
    {
        $user = Session::get('user');

        if (!$user) {
            return json(['code' => 40100, 'msg' => '请先登录', 'data' => null], 401);
        }

        if (($user['role'] ?? '') !== 'admin') {
            return json(['code' => 40300, 'msg' => '当前账号没有后台权限', 'data' => null], 403);
        }

        return $next($request);
    }
}
