<?php
// v2 API 路由（后端只输出 JSON）
use app\middleware\AdminAuth;
use think\facade\Route;

Route::get('api/health', function () {
    return json(['code' => 0, 'msg' => 'ok', 'data' => ['service' => 'bookstore-api', 'time' => date('c')]]);
});

// ---------- 认证 / 账号 ----------
Route::post('api/auth/register', 'api.Auth/register');
Route::post('api/auth/login', 'api.Auth/login');
Route::post('api/auth/logout', 'api.Auth/logout');
Route::get('api/auth/me', 'api.Auth/me');
Route::get('api/auth/csrf', 'api.Auth/csrf');

Route::patch('api/user/profile', 'api.Account/updateProfile');
Route::post('api/user/avatar', 'api.Account/uploadAvatar');

// ---------- 商品 ----------
Route::get('api/categories', 'api.Book/categories');
Route::get('api/books', 'api.Book/index');
Route::get('api/books/:id', 'api.Book/detail');
Route::get('api/cover/:id', 'api.Cover/svg')->pattern(['id' => '\d+']);

// ---------- 购物车 ----------
Route::get('api/cart', 'api.Cart/index');
Route::post('api/cart/items', 'api.Cart/add');
Route::patch('api/cart/items/:book_id', 'api.Cart/update');
Route::delete('api/cart/items/:book_id', 'api.Cart/remove');

// ---------- 结算 / 订单 ----------
Route::get('api/checkout/cart', 'api.Order/checkoutCart');
Route::get('api/checkout/direct', 'api.Order/checkoutDirect');
Route::post('api/orders', 'api.Order/create');
Route::get('api/orders', 'api.Order/index');
Route::get('api/orders/:id', 'api.Order/detail');
Route::post('api/orders/:id/pay', 'api.Order/pay');
Route::post('api/orders/:id/cancel', 'api.Order/cancel');
Route::post('api/orders/:id/receive', 'api.Order/receive');

// ---------- 后台（全部过 AdminAuth） ----------
Route::group('api/admin', function () {
    Route::get('stats', 'api.admin.Index/stats');

    Route::get('books', 'api.admin.Book/index');
    Route::post('books', 'api.admin.Book/store');
    Route::get('books/:id', 'api.admin.Book/show');
    Route::put('books/:id', 'api.admin.Book/update');
    Route::patch('books/:id/status', 'api.admin.Book/status');
    Route::delete('books/:id', 'api.admin.Book/delete');

    Route::get('orders', 'api.admin.Order/index');
    Route::get('orders/:id', 'api.admin.Order/detail');
    Route::post('orders/:id/ship', 'api.admin.Order/ship');
    Route::post('orders/:id/complete', 'api.admin.Order/complete');
    Route::post('orders/:id/cancel', 'api.admin.Order/cancel');

    Route::get('users', 'api.admin.User/index');
    Route::put('users/:id', 'api.admin.User/update');

    Route::get('categories', 'api.admin.Category/index');
    Route::post('categories', 'api.admin.Category/store');
    Route::put('categories/:id', 'api.admin.Category/update');
    Route::delete('categories/:id', 'api.admin.Category/delete');
})->middleware(AdminAuth::class);
