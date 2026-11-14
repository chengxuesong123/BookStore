/**
 * v3 Demo 冒烟：验证 mock 模式（4174）能独立跑起来，并截图
 * 运行：node tests/demo-check.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.DEMO_BASE || 'http://127.0.0.1:4174';
const PORT = process.env.PORT || 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
const failures = [];
const check = (name, ok, detail) => {
    if (ok) { pass++; console.log('  PASS  ' + name); }
    else { failures.push(name); console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
await new Promise((resolve) => { ws.onopen = resolve; });
ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Page.javascriptDialogOpening') {
        ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
    }
    if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
    }
};
const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result ? r.result.value : undefined;
};
const go = async (p) => { await send('Page.navigate', { url: BASE + p }); await sleep(1100); };
const count = (sel) => evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const text = (sel) => evalJs(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const setVal = (sel, v) => evalJs(`(function(){var el=document.querySelector(${JSON.stringify(sel)});el.value=${JSON.stringify(v)};el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const click = (sel) => evalJs(`document.querySelector(${JSON.stringify(sel)}).click(); true`);
const waitFor = async (fn, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try { if (await fn()) return true; } catch (e) { /* retry */ }
        await sleep(200);
    }
    return false;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1800, deviceScaleFactor: 1, mobile: false });

console.log('\n[v3 Demo] mock 模式');
// 每次从干净存档开始，避免上一次登录/购物车影响断言
await go('/');
await evalJs("localStorage.removeItem('moyu-mock-v4'); true");
await send('Page.reload', { ignoreCache: true });
await sleep(1200);
check('首页 20 张书卡可见', await waitFor(async () => (await count('.book-card')) === 20 && (await evalJs('getComputedStyle(document.querySelector(".book-card")).opacity')) === '1'));
check('Hero 漂浮书 3 本', (await count('.hero-books .book-float')) === 3);
check('分类精选 3 张卡', (await count('.promo-card')) === 3);
check('分类卡小书封 3 个', (await count('.promo-card .mini-book')) === 3);

mkdirSync('tests/shots', { recursive: true });
const homeShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync('tests/shots/v3-home.png', Buffer.from(homeShot.data, 'base64'));

await go('/login');
await setVal('input[name=email]', 'admin@moyu.com');
await setVal('input[name=password]', 'admin123');
await click('form button[type=submit]');
check('mock 登录进后台', await waitFor(async () => (await evalJs('location.pathname')) === '/admin'));
check('概览 4 张卡', await waitFor(async () => (await count('.stat-card')) === 4));
const adminShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync('tests/shots/v3-admin.png', Buffer.from(adminShot.data, 'base64'));

// v4：用户管理 + 自动封面表单
await go('/admin/users');
check('Demo 用户管理有数据', await waitFor(async () => (await count('.table-wrap tbody tr')) >= 2));
const usersShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync('tests/shots/v4-users.png', Buffer.from(usersShot.data, 'base64'));

await go('/admin/books/new');
check('Demo 图书表单无封面输入', await waitFor(async () => (await count('#book-form')) === 1) && (await count('#book-form input[name=cover]')) === 0);
const formShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync('tests/shots/v4-bookform.png', Buffer.from(formShot.data, 'base64'));

await go('/book/3');
check('mock 详情页可读', await waitFor(async () => (await text('.detail-info h1')).includes('百年孤独')));
await click('.buy-row button.btn-primary');
check('mock 加购红点', await waitFor(async () => (await count('.cart-badge.show')) === 1));

await go('/cart');
check('mock 购物车有 1 行', (await count('.cart-row')) === 1);
await go('/account');
check('mock 用户中心可打开', (await text('.account-grid')).includes('admin@moyu.com'));

console.log(`\n===== Demo 冒烟：${pass} 通过，${failures.length} 失败 =====`);
ws.close();
if (failures.length) process.exit(1);
