/**
 * v3 Demo 模式：拦截 axios 请求，用 localStorage 模拟后端
 * 只在 VITE_MOCK=1（pnpm dev:mock / build:mock）时安装，真实模式完全不走这里。
 */
import { books as seedBooks, categories as seedCategories } from './data';

const STORAGE_KEY = 'moyu-mock-v4';
const CSRF_TOKEN = 'mock-csrf-token';

function now() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function freshState() {
    return {
        users: [
            {
                id: 1,
                email: 'admin@moyu.com',
                nickname: '店长',
                password: 'admin123',
                role: 'admin',
                avatar: '',
                created_at: now(),
            },
            {
                id: 2,
                email: 'reader@moyu.com',
                nickname: '小鱼',
                password: 'reader123',
                role: 'customer',
                avatar: '',
                created_at: now(),
            },
        ],
        sessionUserId: null,
        guestCart: {},
        carts: {},
        orders: [],
        books: JSON.parse(JSON.stringify(seedBooks)),
        categories: JSON.parse(JSON.stringify(seedCategories)),
        orderSeq: 0,
        bookSeq: 100,
    };
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.books) && parsed.books.length) return parsed;
        }
    } catch (e) { /* 坏的存档直接用新的 */ }
    return freshState();
}

let state = loadState();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

const ok = (data = null, msg = 'ok') => ({ code: 0, msg, data });
const fail = (status, code, msg, errors) => {
    const err = { response: { status, data: { code, msg, data: errors ? { errors } : null } } };
    throw err;
};

const userById = (id) => state.users.find((u) => u.id === id) || null;
const currentUser = () => (state.sessionUserId ? userById(state.sessionUserId) : null);
const publicUser = (u) => u && ({
    id: u.id, email: u.email, nickname: u.nickname, role: u.role, avatar: u.avatar, created_at: u.created_at,
});

function mockCover(title) {
    const text = String(title || 'book');
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    const h1 = hash % 360;
    const h2 = (h1 + 38) % 360;
    return `linear-gradient(150deg, hsl(${h1} 42% 38%), hsl(${h2} 46% 24%))`;
}

function cartKey() {
    const user = currentUser();
    return user ? `u${user.id}` : 'guest';
}

function cartMap() {
    const key = cartKey();
    if (key === 'guest') return state.guestCart;
    return state.carts[key] || (state.carts[key] = {});
}

function cartSnapshot() {
    const map = cartMap();
    const items = [];
    let subtotal = 0;
    let count = 0;
    Object.keys(map).forEach((id) => {
        const book = state.books.find((b) => b.id === Number(id));
        if (!book || book.status !== 'on') return;
        const qty = Math.min(Number(map[id]), book.stock);
        if (qty <= 0) return;
        const line = {
            book: { ...book, tag_list: book.tag_list || [] },
            qty,
            line_total: Math.round(book.price * qty * 100) / 100,
        };
        items.push(line);
        subtotal += line.line_total;
        count += qty;
    });
    subtotal = Math.round(subtotal * 100) / 100;
    const free = subtotal >= 59;
    const shipping = subtotal > 0 && !free ? 6 : 0;
    return { items, totals: { subtotal, shipping, total: Math.round((subtotal + shipping) * 100) / 100, count, free }, count };
}

function mergeGuestCart(userId) {
    const guest = state.guestCart || {};
    if (!Object.keys(guest).length) return;
    const target = state.carts[`u${userId}`] || (state.carts[`u${userId}`] = {});
    Object.keys(guest).forEach((id) => {
        target[id] = (target[id] || 0) + guest[id];
    });
    state.guestCart = {};
}

function buildOrder(payload, user) {
    const direct = payload.mode === 'direct';
    let lines;
    if (direct) {
        const book = state.books.find((b) => b.id === Number(payload.book_id));
        if (!book || book.status !== 'on') fail(404, 40400, '图书不存在或已下架');
        const qty = Math.max(1, Math.min(Number(payload.qty) || 1, book.stock));
        if (book.stock <= 0) fail(422, 42200, '这本书暂时缺货');
        lines = [{ book, qty, line_total: Math.round(book.price * qty * 100) / 100 }];
    } else {
        lines = cartSnapshot().items;
        if (!lines.length) fail(422, 42200, '购物车是空的');
    }

    lines.forEach((line) => {
        const book = state.books.find((b) => b.id === line.book.id);
        if (book.stock < line.qty) fail(422, 42200, `《${line.book.title}》库存不足`);
    });
    lines.forEach((line) => {
        const book = state.books.find((b) => b.id === line.book.id);
        book.stock -= line.qty;
    });

    const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
    const free = subtotal >= 59;
    const total = Math.round((subtotal + (free ? 0 : 6)) * 100) / 100;
    state.orderSeq += 1;
    const order = {
        id: state.orderSeq,
        order_no: 'MYDEMO' + String(state.orderSeq).padStart(6, '0'),
        status: 'pending',
        source: direct ? 'direct' : 'cart',
        total_amount: total,
        receiver: payload.receiver,
        phone: payload.phone,
        address: payload.address,
        remark: payload.remark || '',
        created_at: now(),
        user_id: user.id,
        email: user.email,
        nickname: user.nickname,
        items: lines.map((l) => ({
            book_id: l.book.id,
            book_title: l.book.title,
            cover: l.book.cover,
            price: l.book.price,
            quantity: l.qty,
            line_total: l.line_total,
        })),
    };
    if (!direct) state.carts[`u${user.id}`] = {};
    state.orders.unshift(order);

    return order;
}

const statusText = { pending: '待付款', paid: '待发货', shipped: '已发货', done: '已完成', cancelled: '已取消' };
const orderOut = (o) => ({ ...o, status_text: statusText[o.status] || o.status });

function ownOrder(id, user) {
    const order = state.orders.find((o) => o.id === Number(id));
    if (!order || order.user_id !== user.id) fail(404, 40400, '订单不存在');
    return order;
}

async function fileToDataUrl(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function paged(list, params, defaultSize = 10) {
    const page = Math.max(1, Number(params.page || 1));
    const size = Math.max(1, Number(params.page_size || defaultSize));
    return {
        list: list.slice((page - 1) * size, page * size),
        total: list.length,
        page,
        page_size: size,
    };
}

export function installMock(http) {
    http.defaults.adapter = async (config) => {
        const method = (config.method || 'get').toLowerCase();
        const path = (config.url || '').replace(/^\/api/, '').replace(/\/$/, '') || '/';
        const params = config.params || {};
        let body = config.data;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }
        const user = currentUser();
        const respond = (envelope, status = 200) => ({
            data: envelope, status, statusText: 'OK', headers: {}, config, request: {},
        });

        try {
            // ---------- 认证 ----------
            if (path === '/auth/csrf' && method === 'get') return respond(ok({ token: CSRF_TOKEN }));
            if (path === '/auth/me' && method === 'get') {
                if (!user) fail(401, 40100, '未登录');
                return respond(ok({ user: publicUser(user) }));
            }
            if (path === '/auth/login' && method === 'post') {
                const u = state.users.find((x) => x.email === body.email);
                if (!u || u.password !== body.password) fail(422, 42200, '邮箱或密码不正确', { password: '邮箱或密码不正确' });
                state.sessionUserId = u.id;
                mergeGuestCart(u.id);
                save();
                return respond(ok({ user: publicUser(u), redirect: u.role === 'admin' ? '/admin' : '/' }, '登录成功'));
            }
            if (path === '/auth/register' && method === 'post') {
                if (state.users.some((x) => x.email === body.email)) fail(422, 42200, '这个邮箱已经注册过了', { email: '这个邮箱已经注册过了' });
                const u = {
                    id: state.users.length + 1,
                    email: body.email,
                    nickname: body.nickname,
                    password: body.password,
                    role: 'customer',
                    avatar: '',
                    created_at: now(),
                };
                state.users.push(u);
                state.sessionUserId = u.id;
                mergeGuestCart(u.id);
                save();
                return respond(ok({ user: publicUser(u) }, '注册成功'));
            }
            if (path === '/auth/logout' && method === 'post') {
                state.sessionUserId = null;
                save();
                return respond(ok(null, '已退出'));
            }

            // ---------- 账号 ----------
            if (path === '/user/profile' && method === 'patch') {
                if (!user) fail(401, 40100, '请先登录');
                if (!body.nickname || body.nickname.length < 2) fail(422, 42200, '昵称需要 2–20 个字', { nickname: '昵称需要 2–20 个字' });
                user.nickname = body.nickname;
                save();
                return respond(ok({ user: publicUser(user) }, '昵称已更新'));
            }
            if (path === '/user/avatar' && method === 'post') {
                if (!user) fail(401, 40100, '请先登录');
                const file = body instanceof FormData ? body.get('avatar') : null;
                if (!file) fail(422, 42200, '请选择图片文件', { avatar: '请选择图片文件' });
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    fail(422, 42200, '只支持 jpg / png / webp 图片', { avatar: '只支持 jpg / png / webp' });
                }
                user.avatar = await fileToDataUrl(file);
                save();
                return respond(ok({ user: publicUser(user) }, '头像已更新'));
            }

            // ---------- 商品 ----------
            if (path === '/categories' && method === 'get') {
                return respond(ok({ list: state.categories }));
            }
            if (path === '/books' && method === 'get') {
                let list = state.books.filter((b) => b.status === 'on');
                if (params.cat) list = list.filter((b) => b.category_id === Number(params.cat));
                const kw = String(params.q || '').trim();
                if (kw) {
                    list = list.filter((b) => [b.title, b.author, b.publisher].some((v) => String(v).includes(kw)));
                }
                if (params.sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
                else if (params.sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
                else if (params.sort === 'stock') list = [...list].sort((a, b) => b.stock - a.stock);
                else list = [...list].sort((a, b) => b.id - a.id);
                return respond(ok(paged(list, params)));
            }
            if (/^\/books\/\d+$/.test(path) && method === 'get') {
                const id = Number(path.split('/')[2]);
                const book = state.books.find((b) => b.id === id && b.status === 'on');
                if (!book) fail(404, 40400, '图书不存在或已下架');
                const related = state.books.filter((b) => b.category_id === book.category_id && b.id !== id && b.status === 'on').slice(0, 4);
                return respond(ok({ book, related }));
            }

            // ---------- 购物车 ----------
            if (path === '/cart' && method === 'get') return respond(ok(cartSnapshot()));
            if (path === '/cart/items' && method === 'post') {
                const book = state.books.find((b) => b.id === Number(body.book_id) && b.status === 'on');
                if (!book) fail(404, 40400, '这本书暂时买不到');
                if (book.stock <= 0) fail(422, 42200, '这本书暂时缺货');
                const map = cartMap();
                map[book.id] = Math.min((map[book.id] || 0) + Math.max(1, Number(body.qty) || 1), book.stock);
                save();
                return respond(ok(cartSnapshot(), '已加入购物车'));
            }
            if (/^\/cart\/items\/\d+$/.test(path)) {
                const id = Number(path.split('/')[3]);
                const book = state.books.find((b) => b.id === id);
                if (method === 'patch') {
                    const map = cartMap();
                    const qty = Math.max(0, Math.min(Number(body.qty) || 0, book ? book.stock : 99));
                    if (qty <= 0) delete map[id]; else map[id] = qty;
                } else if (method === 'delete') {
                    delete cartMap()[id];
                }
                save();
                return respond(ok(cartSnapshot(), '已更新'));
            }

            // ---------- 结算 ----------
            if (path === '/checkout/cart' && method === 'get') {
                if (!user) fail(401, 40100, '请先登录');
                const snap = cartSnapshot();
                if (!snap.items.length) fail(422, 42200, '购物车是空的');
                return respond(ok({ mode: 'cart', items: snap.items, totals: snap.totals }));
            }
            if (path === '/checkout/direct' && method === 'get') {
                if (!user) fail(401, 40100, '请先登录');
                const book = state.books.find((b) => b.id === Number(params.book_id) && b.status === 'on');
                if (!book) fail(404, 40400, '图书不存在或已下架');
                const qty = Math.max(1, Math.min(Number(params.qty) || 1, book.stock));
                if (book.stock <= 0) fail(422, 42200, '这本书暂时缺货');
                const line = { book, qty, line_total: Math.round(book.price * qty * 100) / 100 };
                return respond(ok({ mode: 'direct', items: [line], totals: { subtotal: line.line_total, shipping: line.line_total >= 59 ? 0 : 6, total: Math.round((line.line_total + (line.line_total >= 59 ? 0 : 6)) * 100) / 100, count: qty, free: line.line_total >= 59 } }));
            }

            // ---------- 订单 ----------
            if (path === '/orders' && method === 'post') {
                if (!user) fail(401, 40100, '请先登录');
                const required = ['receiver', 'phone', 'address'];
                const errors = {};
                if (!body.receiver || body.receiver.length < 2) errors.receiver = '请填写收货人姓名（至少 2 个字）';
                if (!/^1\d{10}$/.test(body.phone || '')) errors.phone = '请输入正确的 11 位手机号';
                if (!body.address || body.address.length < 6) errors.address = '地址至少填写 6 个字';
                if (Object.keys(errors).length) fail(422, 42200, Object.values(errors)[0], errors);
                const order = buildOrder(body, user);
                save();
                return respond(ok({ order_id: order.id, order_no: order.order_no }, '下单成功'));
            }
            if (path === '/orders' && method === 'get') {
                if (!user) fail(401, 40100, '请先登录');
                const list = state.orders.filter((o) => o.user_id === user.id).map(orderOut);
                return respond(ok(paged(list, params, 10)));
            }
            if (/^\/orders\/\d+$/.test(path) && method === 'get') {
                if (!user) fail(401, 40100, '请先登录');
                return respond(ok({ order: orderOut(ownOrder(path.split('/')[2], user)) }));
            }
            if (/^\/orders\/\d+\/(pay|cancel|receive)$/.test(path) && method === 'post') {
                if (!user) fail(401, 40100, '请先登录');
                const [, , id, action] = path.split('/');
                const order = ownOrder(id, user);
                if (action === 'pay' && order.status === 'pending') order.status = 'paid';
                else if (action === 'receive' && order.status === 'shipped') order.status = 'done';
                else if (action === 'cancel' && order.status === 'pending') {
                    order.status = 'cancelled';
                    order.items.forEach((it) => {
                        const book = state.books.find((b) => b.id === it.book_id);
                        if (book) book.stock += it.quantity;
                    });
                } else fail(422, 42200, '当前状态不能执行该操作');
                save();
                return respond(ok({ order: orderOut(order) }, '操作成功'));
            }

            // ---------- 后台 ----------
            if (path.startsWith('/admin/')) {
                if (!user) fail(401, 40100, '请先登录');
                if (user.role !== 'admin') fail(403, 40300, '当前账号没有后台权限');

                if (path === '/admin/stats') {
                    return respond(ok({
                        book_total: state.books.length,
                        book_on: state.books.filter((b) => b.status === 'on').length,
                        order_total: state.orders.length,
                        order_paid: state.orders.filter((o) => o.status === 'paid').length,
                    }));
                }
                if (path === '/admin/books' && method === 'get') {
                    let list = [...state.books].sort((a, b) => b.id - a.id);
                    const kw = String(params.q || '').trim();
                    if (kw) list = list.filter((b) => b.title.includes(kw));
                    return respond(ok(paged(list, params, 12)));
                }
                if (path === '/admin/books' && method === 'post') {
                    const category = state.categories.find((c) => c.id === Number(body.category_id));
                    if (!body.title || !category || !(Number(body.price) > 0)) fail(422, 42200, '表单校验失败', { title: !body.title ? '书名必填' : '' });
                    state.bookSeq += 1;
                    const book = {
                        id: state.bookSeq,
                        title: body.title,
                        author: body.author || '',
                        publisher: body.publisher || '',
                        category_id: category.id,
                        category_name: category.name,
                        price: Number(body.price),
                        original_price: Number(body.original_price || 0),
                        stock: Number(body.stock || 0),
                        cover: mockCover(body.title),
                        intro: body.intro || '',
                        tags: body.tags || '',
                        tag_list: (body.tags || '').split(',').filter(Boolean),
                        status: body.status || 'on',
                        created_at: now(),
                    };
                    state.books.unshift(book);
                    save();
                    return respond(ok({ book }, '图书已新增'));
                }
                if (/^\/admin\/books\/\d+$/.test(path)) {
                    const id = Number(path.split('/')[3]);
                    const book = state.books.find((b) => b.id === id);
                    if (!book) fail(404, 40400, '图书不存在');
                    if (method === 'get') return respond(ok({ book }));
                    if (method === 'put') {
                        const oldTitle = book.title;
                        Object.assign(book, {
                            title: body.title, author: body.author, publisher: body.publisher,
                            category_id: Number(body.category_id), price: Number(body.price),
                            original_price: Number(body.original_price || 0), stock: Number(body.stock || 0),
                            intro: body.intro, tags: body.tags, status: body.status,
                        });
                        if (oldTitle !== body.title) book.cover = mockCover(body.title);
                        const cat = state.categories.find((c) => c.id === book.category_id);
                        book.category_name = cat ? cat.name : '';
                        save();
                        return respond(ok({ book }, '图书已更新'));
                    }
                    if (method === 'delete') {
                        state.books = state.books.filter((b) => b.id !== id);
                        Object.keys(state.carts).forEach((key) => { delete state.carts[key][id]; });
                        save();
                        return respond(ok(null, '已删除'));
                    }
                }
                if (/^\/admin\/books\/\d+\/status$/.test(path) && method === 'patch') {
                    const id = Number(path.split('/')[3]);
                    const book = state.books.find((b) => b.id === id);
                    if (!book) fail(404, 40400, '图书不存在');
                    book.status = book.status === 'on' ? 'off' : 'on';
                    save();
                    return respond(ok({ book }, book.status === 'on' ? '已上架' : '已下架'));
                }
                if (path === '/admin/orders' && method === 'get') {
                    let list = state.orders.map(orderOut);
                    if (params.status) list = list.filter((o) => o.status === params.status);
                    const kw = String(params.q || '').trim();
                    if (kw) list = list.filter((o) => o.order_no.includes(kw) || o.email.includes(kw));
                    return respond(ok(paged(list, params, 12)));
                }
                if (/^\/admin\/orders\/\d+$/.test(path) && method === 'get') {
                    const order = state.orders.find((o) => o.id === Number(path.split('/')[3]));
                    if (!order) fail(404, 40400, '订单不存在');
                    return respond(ok({ order: orderOut(order) }));
                }
                if (/^\/admin\/orders\/\d+\/(ship|complete|cancel)$/.test(path) && method === 'post') {
                    const [, , , id, action] = path.split('/');
                    const order = state.orders.find((o) => o.id === Number(id));
                    if (!order) fail(404, 40400, '订单不存在');
                    if (action === 'ship' && order.status === 'paid') order.status = 'shipped';
                    else if (action === 'complete' && order.status === 'shipped') order.status = 'done';
                    else if (action === 'cancel' && ['pending', 'paid'].includes(order.status)) {
                        order.status = 'cancelled';
                        order.items.forEach((it) => {
                            const book = state.books.find((b) => b.id === it.book_id);
                            if (book) book.stock += it.quantity;
                        });
                    } else fail(422, 42200, '当前状态不能执行该操作');
                    save();
                    return respond(ok(null, '操作成功'));
                }
                if (path === '/admin/users' && method === 'get') {
                    let users = state.users.map((u) => ({
                        id: u.id,
                        email: u.email,
                        nickname: u.nickname,
                        role: u.role,
                        avatar: u.avatar,
                        created_at: u.created_at,
                        order_count: state.orders.filter((o) => o.user_id === u.id).length,
                    }));
                    const ukw = String(params.q || '').trim();
                    if (ukw) users = users.filter((u) => u.email.includes(ukw) || u.nickname.includes(ukw));
                    return respond(ok(paged(users, params, 15)));
                }
                if (/^\/admin\/users\/\d+$/.test(path) && method === 'put') {
                    const uid = Number(path.split('/')[3]);
                    const target = state.users.find((u) => u.id === uid);
                    if (!target) fail(404, 40400, '用户不存在');
                    const nickname = (body.nickname || target.nickname).trim();
                    const role = body.role || target.role;
                    if (nickname.length < 2 || nickname.length > 20) fail(422, 42200, '昵称需要 2–20 个字', { nickname: '昵称需要 2–20 个字' });
                    if (!['customer', 'admin'].includes(role)) fail(422, 42200, '角色不合法', { role: '角色不合法' });
                    if (uid === user.id && role !== target.role) fail(422, 42200, '不能修改自己的角色', { role: '不能修改自己的角色' });
                    if (target.role === 'admin' && role !== 'admin' && state.users.filter((u) => u.role === 'admin').length <= 1) {
                        fail(422, 42200, '至少要保留一个管理员', { role: '至少要保留一个管理员' });
                    }
                    if (body.password && String(body.password).length < 6) fail(422, 42200, '密码至少 6 位', { password: '密码至少 6 位' });
                    target.nickname = nickname;
                    target.role = role;
                    if (body.password) target.password = body.password;
                    save();
                    return respond(ok({ user: { ...target, order_count: state.orders.filter((o) => o.user_id === uid).length } }, '用户已更新'));
                }
                if (path === '/admin/categories' && method === 'get') {
                    const list = state.categories.map((c) => ({
                        ...c,
                        book_count: state.books.filter((b) => b.category_id === c.id).length,
                    }));
                    return respond(ok({ list }));
                }
                if (path === '/admin/categories' && method === 'post') {
                    if (!body.name) fail(422, 42200, '分类名必填', { name: '分类名必填' });
                    state.categories.push({ id: Math.max(...state.categories.map((c) => c.id)) + 1, name: body.name, sort: Number(body.sort || 0) });
                    save();
                    return respond(ok(null, '分类已新增'));
                }
                if (/^\/admin\/categories\/\d+$/.test(path)) {
                    const id = Number(path.split('/')[3]);
                    const cat = state.categories.find((c) => c.id === id);
                    if (!cat) fail(404, 40400, '分类不存在');
                    if (method === 'put') {
                        cat.name = body.name;
                        cat.sort = Number(body.sort || 0);
                        state.books.forEach((b) => { if (b.category_id === id) b.category_name = cat.name; });
                        save();
                        return respond(ok(null, '分类已更新'));
                    }
                    if (method === 'delete') {
                        if (state.books.some((b) => b.category_id === id)) fail(422, 42200, '该分类下还有书，先处理图书再删');
                        state.categories = state.categories.filter((c) => c.id !== id);
                        save();
                        return respond(ok(null, '分类已删除'));
                    }
                }
            }

            return fail(404, 40400, '接口不存在：' + path);
        } catch (e) {
            if (e && e.response) throw e;
            throw { response: { status: 500, data: { code: 50000, msg: '模拟数据出错了', data: null } } };
        }
    };
}
