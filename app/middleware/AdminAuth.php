<?php
declare(strict_types=1);

namespace app\middleware;

use Closure;
use think\Request;
use think\Response;

/**
 * 后台鉴权：未登录跳登录页，非管理员回首页。
 * 不能只靠前端隐藏入口，服务端必须拦住。
 */
class AdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = current_user();

        if ($user === null) {
            flash_set('后台入口仅对管理员开放，请先登录', 'error');
            return redirect('/login?admin=1&next=' . urlencode('/admin'));
        }

        if (($user['role'] ?? '') !== 'admin') {
            flash_set('当前账号没有后台权限', 'error');
            return redirect('/');
        }

        return $next($request);
    }
}
