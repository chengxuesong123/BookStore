<?php
declare(strict_types=1);

namespace app\middleware;

use Closure;
use think\facade\Session;
use think\Request;

/**
 * 表单 CSRF 校验：POST 必须带 _token 或 X-CSRF-Token 头
 */
class VerifyCsrf
{
    public function handle(Request $request, Closure $next)
    {
        if (!$request->isPost()) {
            return $next($request);
        }

        $token = (string) $request->post('_token', '');
        if ($token === '') {
            $token = (string) $request->header('x-csrf-token', '');
        }
        $expected = (string) Session::get('_csrf', '');

        if ($expected === '' || $token === '' || !hash_equals($expected, $token)) {
            if ($request->isAjax()) {
                return json(['code' => 419, 'msg' => '页面已过期，请刷新后重试'], 419);
            }

            return response('页面已过期，请刷新后重试', 419);
        }

        return $next($request);
    }
}
