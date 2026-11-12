<?php
declare(strict_types=1);

namespace app\middleware;

use Closure;
use think\facade\Session;
use think\Request;

/**
 * API CSRF：写请求必须带 X-CSRF-Token 头（或 _token 字段）
 */
class VerifyCsrf
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->isGet() || $request->isHead() || $request->isOptions()) {
            return $next($request);
        }

        $token = (string) $request->header('x-csrf-token', '');
        if ($token === '') {
            $token = (string) $request->post('_token', '');
        }
        if ($token === '') {
            $raw = (string) $request->getInput();
            $json = json_decode($raw, true);
            if (is_array($json) && isset($json['_token'])) {
                $token = (string) $json['_token'];
            }
        }

        $expected = (string) Session::get('_csrf', '');
        if ($expected === '' || $token === '' || !hash_equals($expected, $token)) {
            return json(['code' => 41900, 'msg' => '页面已过期，请刷新后重试', 'data' => null], 419);
        }

        return $next($request);
    }
}
