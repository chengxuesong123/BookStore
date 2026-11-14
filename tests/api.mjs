/**
 * v2 接口契约测试（Node fetch + 手动 cookie jar）
 * 前置：后端已启动 http://127.0.0.1:8124 ，数据库已初始化
 * 运行：node tests/api.mjs [--reset]
 */
import { spawnSync } from 'node:child_process';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8124/api';
const ROOT = process.cwd();
const PHP = 'D:\\wamp\\webserve\\phpstudy_pro\\Extensions\\php\\php8.3nts\\php.exe';

let pass = 0;
const failures = [];
function check(name, ok, detail) {
    if (ok) { pass++; console.log('  PASS  ' + name); }
    else { failures.push(name); console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

if (process.argv.includes('--reset')) {
    console.log('重置数据库…');
    const r = spawnSync(PHP, ['think', 'db:init', '--seed', '--force'], { cwd: ROOT + '\\server', stdio: 'inherit' });
    if (r.status !== 0) { console.error('db:init 失败'); process.exit(1); }
}

class Jar {
    constructor() { this.cookies = new Map(); }
    apply() {
        return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    absorb(res) {
        const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
        for (const line of list) {
            const [pair] = line.split(';');
            const idx = pair.indexOf('=');
            if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
        }
    }
}

class Client {
    constructor() {
        this.jar = new Jar();
        this.token = '';
    }
    async req(method, path, body, extraHeaders = {}) {
        const headers = { ...extraHeaders };
        const cookie = this.jar.apply();
        if (cookie) headers.Cookie = cookie;
        if (this.token && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = this.token;
        let payload;
        if (body instanceof FormData) {
            payload = body;
        } else if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }
        const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' });
        this.jar.absorb(res);
        let json = null;
        try { json = await res.json(); } catch (e) { json = null; }
        return { status: res.status, body: json, contentType: res.headers.get('content-type') || '' };
    }
    get(p) { return this.req('GET', p); }
    post(p, b = {}) { return this.req('POST', p, b); }
    patch(p, b = {}) { return this.req('PATCH', p, b); }
    put(p, b = {}) { return this.req('PUT', p, b); }
    del(p) { return this.req('DELETE', p); }
    async csrf() {
        const r = await this.get('/auth/csrf');
        this.token = r.body?.data?.token || '';
        return this.token;
    }
}

const admin = new Client();
await admin.csrf();
const login = await admin.post('/auth/login', { email: 'admin@moyu.com', password: 'admin123' });
check('管理员登录成功', login.status === 200 && login.body.data.user.role === 'admin');

const anon = new Client();
await anon.csrf();
const anonStats = await anon.get('/admin/stats');
check('未登录访问后台接口 401', anonStats.status === 401);

const customer = new Client();
await customer.csrf();
const email = `e2e-${Date.now()}@test.com`;
const reg = await customer.post('/auth/register', {
    email, nickname: '测试鱼', password: 'test123456', confirm: 'test123456',
});
check('注册成功', reg.status === 200 && reg.body.data.user.role === 'customer');

const customerStats = await customer.get('/admin/stats');
check('顾客访问后台接口 403', customerStats.status === 403);

const savedToken = customer.token;
customer.token = '';
const csrfFail = await customer.post('/cart/items', { book_id: 3, qty: 1 });
customer.token = savedToken;
check('缺 CSRF token 返回 419', csrfFail.status === 419);

const books = await customer.get('/books?page_size=50');
check('图书列表返回 500 本', books.body.data.total === 500, String(books.body.data.total));
const defaultPage = await customer.get('/books');
check('默认每页 10 本', defaultPage.body.data.list.length === 10, String(defaultPage.body.data.list.length));
const catTotals = [];
for (let cid = 1; cid <= 6; cid++) {
    const r = await customer.get(`/books?cat=${cid}&page_size=200`);
    catTotals.push(r.body.data.total);
}
check('每个分类至少 10 本', catTotals.every((n) => n >= 10), JSON.stringify(catTotals));
const coverRes = await customer.req('GET', '/cover/1');
check('本地 SVG 书封可用', coverRes.status === 200 && String(coverRes.contentType).includes('image/svg+xml'), String(coverRes.contentType));
const book = books.body.data.list.find((b) => b.stock >= 2) || books.body.data.list[0];
check('图书字段完整', typeof book.price === 'number' && typeof book.stock === 'number' && !!book.title);

const detail = await customer.get(`/books/${book.id}`);
check('图书详情 + 推荐', detail.status === 200 && Array.isArray(detail.body.data.related));

await customer.post('/cart/items', { book_id: book.id, qty: 2 });
const cart = await customer.get('/cart');
check('加购后购物车件数 2', cart.body.data.count === 2, String(cart.body.data.count));

const preview = await customer.get(`/checkout/direct?book_id=${book.id}&qty=1`);
check('立即购买预览只含 1 行', preview.status === 200 && preview.body.data.items.length === 1);

const stockBefore = (await customer.get(`/books/${book.id}`)).body.data.book.stock;
const order = await customer.post('/orders', {
    mode: 'direct', book_id: book.id, qty: 1,
    receiver: '小鱼', phone: '13800001111', address: '浙江省杭州市西湖区文三路 1 号', remark: '',
});
check('立即购买下单成功', order.status === 200 && order.body.data.order_id > 0, JSON.stringify(order.body));

const cartAfter = await customer.get('/cart');
check('立即购买不动购物车', cartAfter.body.data.count === 2, String(cartAfter.body.data.count));
const stockAfter = (await customer.get(`/books/${book.id}`)).body.data.book.stock;
check('立即购买扣减 1 本库存', stockAfter === stockBefore - 1, `${stockBefore} → ${stockAfter}`);

const orderDetail = await customer.get(`/orders/${order.body.data.order_id}`);
check('订单详情可读', orderDetail.status === 200 && orderDetail.body.data.order.source === 'direct');

const pay = await customer.post(`/orders/${order.body.data.order_id}/pay`);
check('付款后状态 paid', pay.body.data.order.status === 'paid');

const adminDetail = await admin.get(`/admin/orders/${order.body.data.order_id}`);
check('后台能看订单', adminDetail.status === 200 && adminDetail.body.data.order.email === email);
const ship = await admin.post(`/admin/orders/${order.body.data.order_id}/ship`);
check('后台发货后 shipped', ship.status === 200);
const receive = await customer.post(`/orders/${order.body.data.order_id}/receive`);
check('收货后 done', receive.body.data.order.status === 'done');

const stockBefore2 = (await customer.get(`/books/${book.id}`)).body.data.book.stock;
const order2 = await customer.post('/orders', {
    mode: 'direct', book_id: book.id, qty: 1,
    receiver: '小鱼', phone: '13800001111', address: '浙江省杭州市西湖区文三路 1 号', remark: '',
});
const cancel = await customer.post(`/orders/${order2.body.data.order_id}/cancel`);
check('取消订单成功', cancel.body.data.order.status === 'cancelled');
const stockRestored = (await customer.get(`/books/${book.id}`)).body.data.book.stock;
check('取消回补库存', stockRestored === stockBefore2, `${stockBefore2} → ${stockRestored}`);

const other = new Client();
await other.csrf();
await other.post('/auth/register', {
    email: `other-${Date.now()}@test.com`, nickname: '路人鱼', password: 'test123456', confirm: 'test123456',
});
const foreignOrder = await other.get(`/orders/${order.body.data.order_id}`);
check('越权看他人订单 404', foreignOrder.status === 404);

// 头像上传（multipart）
const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
]);
const form = new FormData();
form.append('avatar', new Blob([png], { type: 'image/png' }), 'a.png');
const upload = await customer.req('POST', '/user/avatar', form);
check('头像上传成功', upload.status === 200 && upload.body.data.user.avatar.startsWith('/uploads/avatars/'), JSON.stringify(upload.body));

const txt = new FormData();
txt.append('avatar', new Blob([new TextEncoder().encode('not an image')], { type: 'text/plain' }), 'a.txt');
const badUpload = await customer.req('POST', '/user/avatar', txt);
check('非图片文件被拒绝', badUpload.status === 422);

const nick = await customer.patch('/user/profile', { nickname: '改过的昵称' });
check('昵称修改成功', nick.status === 200 && nick.body.data.user.nickname === '改过的昵称');

const cats = await admin.get('/admin/categories');
check('后台分类列表', cats.status === 200 && cats.body.data.list.length === 6);

const newCat = await admin.post('/admin/categories', { name: '接口测试分类', sort: 99 });
check('新增分类', newCat.status === 200);
const catId = newCat.body.data.category.id;
const delCat = await admin.del(`/admin/categories/${catId}`);
check('删除空分类', delCat.status === 200);

const firstCat = cats.body.data.list[0];
const delUsed = await admin.del(`/admin/categories/${firstCat.id}`);
check('有书的分类拒绝删除', delUsed.status === 422);

// 用户管理
const users = await admin.get('/admin/users');
check('后台用户列表可用', users.status === 200 && users.body.data.total >= 2, String(users.body.data.total));
const target = users.body.data.list.find((u) => u.email === email);
check('用户列表带订单数', target && typeof target.order_count === 'number');
const editedUser = await admin.put(`/admin/users/${target.id}`, { nickname: '被管过的昵称', role: 'customer' });
check('后台修改昵称成功', editedUser.status === 200 && editedUser.body.data.user.nickname === '被管过的昵称');
const selfDemote = await admin.put('/admin/users/1', { nickname: '店长', role: 'customer' });
check('不能修改自己的角色', selfDemote.status === 422);
const badPwd = await admin.put(`/admin/users/${target.id}`, { nickname: '被管过的昵称', role: 'customer', password: '123' });
check('重置密码长度校验', badPwd.status === 422);
check('顾客不能访问用户管理', (await customer.get('/admin/users')).status === 403);

// 新增图书：不再接收手填封面，服务端按书名自动取（取不到留空，前端占位）
const created = await admin.post('/admin/books', {
    title: '封面自动测试书', category_id: 1, author: '测试作者', price: 30, original_price: 40, stock: 5, status: 'on',
});
check('新增图书不填封面也能成功', created.status === 200 && typeof created.body.data.book.cover === 'string');
check('封面字段不是手填值', created.body.data.book.cover !== '客户端手填');
const createdId = created.body.data.book.id;
await admin.del(`/admin/books/${createdId}`);

// 封面解析（不依赖外网，直接喂样例 JSON）
const coverParse = spawnSync(PHP, ['tests/cover-parse.php'], { cwd: ROOT, encoding: 'utf8' });
check('封面解析逻辑正确', coverParse.status === 0 && coverParse.stdout.includes('cover-parse ok'), coverParse.stdout + coverParse.stderr);

console.log(`\n===== 接口测试：${pass} 通过，${failures.length} 失败 =====`);
if (failures.length) {
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
}
