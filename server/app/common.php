<?php
// 应用公共函数（v2 API 版）
use think\facade\Session;

/**
 * 当前登录用户（未登录返回 null）
 * @return array{id:int,email:string,nickname:string,role:string,avatar?:string}|null
 */
function current_user(): ?array
{
    $user = Session::get('user');

    return $user ?: null;
}

function is_admin(): bool
{
    $user = current_user();

    return $user !== null && ($user['role'] ?? '') === 'admin';
}

/**
 * 订单状态文案
 */
function order_status_text(string $status): string
{
    return [
        'pending'   => '待付款',
        'paid'      => '待发货',
        'shipped'   => '已发货',
        'done'      => '已完成',
        'cancelled' => '已取消',
    ][$status] ?? $status;
}

/**
 * 购物车件数（游客 session / 登录用户数据库，由 CartService 统一处理）
 */
function cart_count(): int
{
    if (class_exists(\app\service\CartService::class)) {
        return \app\service\CartService::count();
    }

    return 0;
}

/**
 * 当前会话的 CSRF token（没有就生成）
 */
function csrf_token(): string
{
    $token = (string) Session::get('_csrf', '');
    if ($token === '') {
        $token = bin2hex(random_bytes(16));
        Session::set('_csrf', $token);
    }

    return $token;
}
