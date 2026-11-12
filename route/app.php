<?php
// 前台路由
use think\facade\Route;

Route::get('/', 'Index/index');

Route::get('books', 'Book/index');
Route::get('book/:id', 'Book/detail')->pattern(['id' => '\d+']);

Route::get('cart', 'Cart/index');
Route::post('cart/add', 'Cart/add');
Route::post('cart/update', 'Cart/update');
Route::post('cart/remove', 'Cart/remove');

Route::get('checkout', 'Order/checkout');
Route::post('checkout', 'Order/create');
Route::get('orders', 'Order/index');
Route::get('order/:id', 'Order/detail')->pattern(['id' => '\d+']);
Route::post('order/:id/pay', 'Order/pay')->pattern(['id' => '\d+']);
Route::post('order/:id/cancel', 'Order/cancel')->pattern(['id' => '\d+']);
Route::post('order/:id/receive', 'Order/receive')->pattern(['id' => '\d+']);

Route::get('login', 'User/loginPage');
Route::post('login', 'User/login');
Route::get('register', 'User/registerPage');
Route::post('register', 'User/register');
Route::get('logout', 'User/logout');

// 后台：整组过管理员中间件
Route::group('admin', function () {
    Route::get('/', 'admin.Index/index');
    Route::get('books', 'admin.Book/index');
    Route::get('books/create', 'admin.Book/create');
    Route::post('books/save', 'admin.Book/save');
    Route::get('books/:id/edit', 'admin.Book/edit')->pattern(['id' => '\d+']);
    Route::post('books/:id/update', 'admin.Book/update')->pattern(['id' => '\d+']);
    Route::post('books/:id/toggle', 'admin.Book/toggle')->pattern(['id' => '\d+']);
    Route::post('books/:id/delete', 'admin.Book/delete')->pattern(['id' => '\d+']);
    Route::get('orders', 'admin.Order/index');
    Route::get('orders/:id', 'admin.Order/detail')->pattern(['id' => '\d+']);
    Route::post('orders/:id/ship', 'admin.Order/ship')->pattern(['id' => '\d+']);
    Route::post('orders/:id/complete', 'admin.Order/complete')->pattern(['id' => '\d+']);
    Route::post('orders/:id/cancel', 'admin.Order/cancel')->pattern(['id' => '\d+']);
    Route::get('categories', 'admin.Category/index');
    Route::post('categories/save', 'admin.Category/save');
    Route::post('categories/:id/delete', 'admin.Category/delete')->pattern(['id' => '\d+']);
})->middleware(\app\middleware\AdminAuth::class);
