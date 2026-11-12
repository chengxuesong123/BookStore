<?php
declare(strict_types=1);

namespace app\service;

use app\model\Book as BookModel;
use app\model\CartItem;
use think\facade\Session;

/**
 * 购物车：游客存 session，登录用户落库，登录时合并
 */
class CartService
{
    public const FREE_SHIPPING = 59.0;
    public const SHIPPING_FEE  = 6.0;

    public static function userId(): int
    {
        $user = current_user();

        return $user ? (int) $user['id'] : 0;
    }

    /**
     * 原始映射：book_id => quantity
     */
    public static function raw(): array
    {
        $map = [];
        $uid = self::userId();

        if ($uid > 0) {
            foreach (CartItem::where('user_id', $uid)->select() as $row) {
                $map[(int) $row['book_id']] = (int) $row['quantity'];
            }
        } else {
            foreach ((array) Session::get('cart', []) as $bid => $qty) {
                $map[(int) $bid] = (int) $qty;
            }
        }

        return $map;
    }

    /**
     * 详情行：只保留在售且有库存的书
     * @return array<int, array{book:array, qty:int, line_total:float}>
     */
    public static function items(): array
    {
        $map = self::raw();
        if (!$map) {
            return [];
        }

        $books = BookModel::withCategory()
            ->whereIn('b.id', array_keys($map))
            ->where('b.status', 'on')
            ->select();

        $lines = [];
        foreach ($books as $book) {
            $qty = min((int) $map[(int) $book['id']], (int) $book['stock']);
            if ($qty <= 0) {
                continue;
            }
            $lines[] = [
                'book'       => $book,
                'qty'        => $qty,
                'line_total' => round($qty * (float) $book['price'], 2),
            ];
        }

        return $lines;
    }

    public static function count(): int
    {
        return array_sum(self::raw());
    }

    public static function add(int $bookId, int $qty): void
    {
        $qty = max(1, min($qty, 99));
        $book = BookModel::where('id', $bookId)->where('status', 'on')->find();
        if ($book === null || (int) $book['stock'] <= 0) {
            return;
        }

        $uid = self::userId();
        if ($uid > 0) {
            $row = CartItem::where('user_id', $uid)->where('book_id', $bookId)->find();
            $next = min(($row ? (int) $row['quantity'] : 0) + $qty, (int) $book['stock']);
            if ($row) {
                $row->save(['quantity' => $next]);
            } else {
                CartItem::create(['user_id' => $uid, 'book_id' => $bookId, 'quantity' => $next]);
            }

            return;
        }

        $cart = (array) Session::get('cart', []);
        $cart[$bookId] = min(((int) ($cart[$bookId] ?? 0)) + $qty, (int) $book['stock']);
        Session::set('cart', $cart);
    }

    /**
     * 设置数量（0 视为移除）
     */
    public static function setQty(int $bookId, int $qty): void
    {
        $uid = self::userId();

        if ($qty <= 0) {
            self::remove($bookId);
            return;
        }

        if ($uid > 0) {
            $stock = (int) BookModel::where('id', $bookId)->value('stock');
            $qty = min($qty, max($stock, 0));
            $row = CartItem::where('user_id', $uid)->where('book_id', $bookId)->find();
            if ($row) {
                $row->save(['quantity' => $qty]);
            } else {
                CartItem::create(['user_id' => $uid, 'book_id' => $bookId, 'quantity' => $qty]);
            }

            return;
        }

        $cart = (array) Session::get('cart', []);
        if (isset($cart[$bookId])) {
            $stock = (int) BookModel::where('id', $bookId)->value('stock');
            $cart[$bookId] = min($qty, max($stock, 0));
            Session::set('cart', $cart);
        }
    }

    public static function remove(int $bookId): void
    {
        $uid = self::userId();
        if ($uid > 0) {
            CartItem::where('user_id', $uid)->where('book_id', $bookId)->delete();

            return;
        }

        $cart = (array) Session::get('cart', []);
        unset($cart[$bookId]);
        Session::set('cart', $cart);
    }

    public static function clear(): void
    {
        $uid = self::userId();
        if ($uid > 0) {
            CartItem::where('user_id', $uid)->delete();
        }
        Session::delete('cart');
    }

    /**
     * 登录后把游客购物车并进数据库
     */
    public static function mergeGuestCart(int $userId): void
    {
        $cart = (array) Session::get('cart', []);
        if (!$cart || $userId <= 0) {
            return;
        }

        foreach ($cart as $bookId => $qty) {
            $bookId = (int) $bookId;
            $qty = (int) $qty;
            $book = BookModel::where('id', $bookId)->where('status', 'on')->find();
            if ($book === null || $qty <= 0) {
                continue;
            }
            $row = CartItem::where('user_id', $userId)->where('book_id', $bookId)->find();
            $next = min((int) $book['stock'], ($row ? (int) $row['quantity'] : 0) + $qty);
            if ($row) {
                $row->save(['quantity' => $next]);
            } else {
                CartItem::create(['user_id' => $userId, 'book_id' => $bookId, 'quantity' => $next]);
            }
        }

        Session::delete('cart');
    }

    /**
     * 金额汇总
     * @return array{subtotal:float, shipping:float, total:float, count:int, free:bool}
     */
    public static function totals(array $items): array
    {
        $subtotal = 0.0;
        $count = 0;
        foreach ($items as $line) {
            $subtotal += (float) $line['line_total'];
            $count += (int) $line['qty'];
        }
        $subtotal = round($subtotal, 2);
        $free = $subtotal >= self::FREE_SHIPPING;
        $shipping = ($subtotal > 0 && !$free) ? self::SHIPPING_FEE : 0.0;

        return [
            'subtotal' => $subtotal,
            'shipping' => $shipping,
            'total'    => round($subtotal + $shipping, 2),
            'count'    => $count,
            'free'     => $free,
        ];
    }
}
