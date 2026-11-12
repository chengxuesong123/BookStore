<?php
// 应用公共文件

use think\facade\Session;

/**
 * 写入一条一次性提示（下一个请求展示后即清除）
 */
function flash_set(string $message, string $type = 'ok'): void
{
    Session::set('flash', ['msg' => $message, 'type' => $type]);
}

/**
 * 取出提示并清空
 * @return array{msg:string,type:string}|null
 */
function flash_get(): ?array
{
    $flash = Session::get('flash');
    Session::delete('flash');
    return is_array($flash) ? $flash : null;
}

/**
 * 金额格式化
 */
function yuan($value): string
{
    return '¥' . number_format((float) $value, 2);
}

/**
 * 订单状态中文名
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
 * 当前登录用户（未登录返回 null）
 * @return array{id:int,email:string,nickname:string,role:string}|null
 */
function current_user(): ?array
{
    $user = Session::get('user');
    return is_array($user) ? $user : null;
}

/**
 * 是否管理员
 */
function is_admin(): bool
{
    $user = current_user();
    return $user !== null && ($user['role'] ?? '') === 'admin';
}

/**
 * 购物车件数（游客读 session，登录用户由 CartService 处理）
 */
function cart_count(): int
{
    if (class_exists(\app\service\CartService::class)) {
        return \app\service\CartService::count();
    }

    return 0;
}
