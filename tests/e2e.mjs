/**
 * v2 端到端测试：Vue 前端（5173）+ TP8 API（8124），Edge headless + CDP
 *
 * 前置：
 *   1) 后端：cd server && php -S 127.0.0.1:8124 -t public public/router.php
 *   2) 前端：cd bookstor && pnpm dev
 *   3) Edge：--headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir=tests/.edge-profile
 *
 * 运行：node tests/e2e-v2.mjs [--reset]
 */
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const PHP = 'D:\\wamp\\webserve\\phpstudy_pro\\Extensions\\php\\php8.3nts\\php.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:5173';
const PORT = process.env.PORT || 9333;

let pass = 0;
const failures = [];
const exceptions = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, ok, detail) {
    if (ok) { pass++; console.log('  PASS  ' + name); }
    else { failures.push(name); console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

if (process.argv.includes('--reset')) {
    console.log('重置数据库…');
    const r = spawnSync(PHP, ['think', 'db:init', '--seed', '--force'], { cwd: ROOT + '\\server', stdio: 'inherit' });
    if (r.status !== 0) { console.error('db:init 失败'); process.exit(1); }
}

async function target() {
    for (let i = 0; i < 60; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(1200) })).json();
            const page = list.find((t) => t.type === 'page');
            if (page) return page;
        } catch { /* 未就绪 */ }
        await sleep(250);
    }
    throw new Error('连不上调试端口，请先启动 Edge');
}

function connect(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => reject(new Error('WebSocket 超时')), 10000);
        let seq = 0;
        const pending = new Map();
        ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.method === 'Page.javascriptDialogOpening') {
                ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                exceptions.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
            }
            if (msg.id && pending.has(msg.id)) {
                const { res, rej } = pending.get(msg.id);
                pending.delete(msg.id);
                if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
            }
        };
        ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket 错误')); };
        ws.onopen = () => {
            clearTimeout(timer);
            resolve({
                send(method, params = {}) {
                    return new Promise((res, rej) => {
                        const id = ++seq;
                        const t = setTimeout(() => { pending.delete(id); rej(new Error('CDP 超时：' + method)); }, 20000);
                        pending.set(id, {
                            res: (v) => { clearTimeout(t); res(v); },
                            rej: (e) => { clearTimeout(t); rej(e); },
                        });
                        ws.send(JSON.stringify({ id, method, params }));
                    });
                },
                close() { ws.close(); },
            });
        };
    });
}

const page = await target();
const cdp = await connect(page.webSocketDebuggerUrl);
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.clearBrowserCache');
await cdp.send('Network.clearBrowserCookies');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const evalJs = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('JS 异常：' + (r.exceptionDetails.exception?.description || ''));
    return r.result ? r.result.value : undefined;
};
const go = async (path) => {
    await cdp.send('Page.navigate', { url: BASE + path });
    await sleep(900);
};
const reload = async () => { await cdp.send('Page.reload', { ignoreCache: true }); await sleep(1200); };
const text = async (sel) => evalJs(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const count = async (sel) => evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const click = async (sel) => { await evalJs(`document.querySelector(${JSON.stringify(sel)}).click(); true`); };
const setVal = async (sel, val) => {
    await evalJs(`(function(){var el=document.querySelector(${JSON.stringify(sel)});el.value=${JSON.stringify(val)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
};
const submit = async (sel) => { await evalJs(`document.querySelector(${JSON.stringify(sel)}).requestSubmit(); true`); };
const waitFor = async (fn, timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try { if (await fn()) return true; } catch { /* 切换中 */ }
        await sleep(200);
    }
    return false;
};
const path = () => evalJs('location.pathname');
const search = () => evalJs('location.search');
const logout = async () => {
    await evalJs(`(function(){
        var a=[...document.querySelectorAll('.topbar-links a, .admin-side-foot a')].find(function(x){return x.textContent.trim()==='退出登录'});
        if(a) a.click();
        return true;
    })()`);
    await sleep(900);
};

try {
    console.log('\n[1] 首页、图标与红点');
    await go('/');
    check('首页渲染标题', await waitFor(async () => (await text('.hero h1')).includes('一本书')));
    check('书卡 16 张', await waitFor(async () => (await count('.book-card')) === 16, 8000));
    check('搜索与购物车是 SVG 图标', (await count('.header-actions .icon-btn svg.ui-icon')) === 2);
    const iconSize = await evalJs('getComputedStyle(document.querySelector(".header-actions .ui-icon")).width');
    check('图标尺寸 24px', iconSize === '24px', iconSize);
    const centers = await evalJs(`(function(){
        var bs=[...document.querySelectorAll('.header-actions .icon-btn')];
        return bs.map(function(b){var r=b.getBoundingClientRect();return Math.round(r.top+r.height/2);});
    })()`);
    check('两个图标垂直居中对齐', centers.length === 2 && Math.abs(centers[0] - centers[1]) <= 1, JSON.stringify(centers));
    check('空购物车没有红点', (await count('.cart-badge.show')) === 0);
    check('游客显示登录按钮', (await count('.btn-login')) === 1);

    // v3：书卡必须真的可见（样式里 opacity:0 靠 .in 打开）
    check('书卡已入场可见', await waitFor(async () => (await evalJs('getComputedStyle(document.querySelector(".book-card")).opacity')) === '1', 8000));
    const firstCardBox = await evalJs('(function(){var r=document.querySelector(".book-card").getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)};})()');
    check('书卡有实际尺寸', firstCardBox.w > 150 && firstCardBox.h > 200, JSON.stringify(firstCardBox));
    check('Hero 漂浮书 3 本', (await count('.hero-books .book-float.b1, .hero-books .book-float.b2, .hero-books .book-float.b3')) === 3);
    const floatBox = await evalJs('(function(){var r=document.querySelector(".book-float").getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)};})()');
    check('漂浮书尺寸正常', floatBox.w > 120 && floatBox.h > 180, JSON.stringify(floatBox));
    check('分类卡 mini-book 3 个', (await count('.promo-card .mini-book')) === 3);

    // v3：搜索浮层点外部收起
    await click('.header-actions .icon-btn[aria-label="搜索"]');
    check('点图标打开搜索', (await count('.search-overlay')) === 1);
    await evalJs('document.querySelector(".hero h1").dispatchEvent(new MouseEvent("mousedown",{bubbles:true})); true');
    check('点页面其他位置收起搜索', await waitFor(async () => (await count('.search-overlay')) === 0, 4000));
    await click('.header-actions .icon-btn[aria-label="搜索"]');
    await click('.main-nav a[href="/books"]');
    check('切换页面后搜索收起', await waitFor(async () => (await count('.search-overlay')) === 0, 8000));
    await go('/');

    console.log('\n[2] 注册、头像与用户中心');
    await go('/register');
    await setVal('input[name=email]', `e2e-${Date.now()}@test.com`);
    await setVal('input[name=nickname]', '小鱼');
    await setVal('input[name=password]', 'test123456');
    await setVal('input[name=confirm]', 'test123456');
    await submit('form');
    check('注册后回首页', await waitFor(async () => (await path()) === '/', 12000));
    check('顶栏变成头像按钮', await waitFor(async () => (await count('.header-actions .avatar-btn')) === 1, 8000));
    const avatarSize = await evalJs('Math.round(document.querySelector(".avatar-btn").getBoundingClientRect().width)');
    check('头像放大到 40px', avatarSize === 40, String(avatarSize));
    check('无头像时显示昵称首字', (await text('.avatar-btn .avatar-initial')).trim() === '小');

    await click('.header-actions .avatar-btn');
    check('点头像进入用户中心', await waitFor(async () => (await path()) === '/account', 8000));
    check('用户中心显示邮箱', (await text('.account-grid')).includes('@test.com'));
    await setVal('.account-grid input[name=nickname]', '小鱼二号');
    await submit('.account-card form');
    check('昵称保存后顶栏更新', await waitFor(async () => (await text('.topbar-links')).includes('小鱼二号'), 8000));

    console.log('\n[3] 加购与红点');
    await go('/book/3');
    check('详情页加载', await waitFor(async () => (await text('.detail-info h1')).includes('百年孤独')));
    await click('.buy-row button.btn-primary');
    check('加购后红点出现', await waitFor(async () => (await text('.cart-badge.show')).trim() === '1', 8000));
    await go('/cart');
    check('购物车有 1 行', await waitFor(async () => (await count('.cart-row')) === 1));

    console.log('\n[4] 立即购买');
    await go('/book/5');
    await waitFor(async () => (await count('.buy-row')) === 1);
    const cartBadgeBefore = (await text('.cart-badge.show')).trim();
    await click('.buy-row button.btn-ghost');
    check('立即购买跳到确认订单', await waitFor(async () => (await path()) === '/checkout', 8000));
    check('确认订单是 direct 模式', (await search()).includes('mode=direct'));
    check('订单明细只有 1 行', await waitFor(async () => (await count('.summary .sum-row')) >= 1));
    check('购物车件数不变', (await text('.cart-badge.show')).trim() === cartBadgeBefore);

    await setVal('input[name=phone]', '13800001111');
    await setVal('textarea[name=address]', '浙江省杭州市西湖区文三路 9 号');
    await submit('#checkout-form');
    check('提交后进入订单详情', await waitFor(async () => /^\/order\/\d+$/.test(await path()), 12000));
    check('订单状态待付款', await waitFor(async () => (await text('.detail-card .pill')).includes('待付款'), 8000));
    check('订单标记为立即购买', await waitFor(async () => (await text('.detail-card')).includes('立即购买'), 8000));
    await go('/cart');
    check('直购后购物车仍 1 件', await waitFor(async () => (await text('.cart-badge.show')).trim() === cartBadgeBefore));

    console.log('\n[5] 后台导航与权限');
    await go('/admin');
    check('顾客访问后台被拦回首页', await waitFor(async () => (await path()) === '/', 8000));

    await logout();
    await go('/login');
    await setVal('input[name=email]', 'admin@moyu.com');
    await setVal('input[name=password]', 'admin123');
    await submit('form');
    check('管理员登录进后台', await waitFor(async () => (await path()) === '/admin', 12000));
    check('侧边栏 4 个入口', (await count('.admin-nav a')) === 4);
    check('概览统计 4 张卡', await waitFor(async () => (await count('.stat-card')) === 4));
    check('后台顶部有面包屑', (await text('.admin-top .crumb')).includes('后台'));

    await click('.admin-nav a[href="/admin/books"]');
    check('进入图书管理', await waitFor(async () => (await path()) === '/admin/books', 8000));
    check('图书表格有数据', await waitFor(async () => (await count('.table-wrap tbody tr')) >= 1));

    await reload();
    check('刷新后仍在图书管理', (await path()) === '/admin/books');
    check('刷新后侧边栏还在', (await count('.admin-nav a')) === 4);

    await click('.admin-nav a[href="/admin/orders"]');
    check('进入订单管理', await waitFor(async () => (await path()) === '/admin/orders', 8000));
    check('订单表有数据', await waitFor(async () => (await count('.table-wrap tbody tr')) >= 1));
    await click('.table-wrap tbody tr a[href^="/admin/orders/"]');
    check('进入后台订单详情', await waitFor(async () => /^\/admin\/orders\/\d+$/.test(await path()), 8000));
    await reload();
    check('刷新后订单详情仍在', /^\/admin\/orders\/\d+$/.test(await path()));

    await go('/');
    check('管理员前台有后台入口', await waitFor(async () => (await count('.admin-chip')) === 1, 8000));
    await click('.admin-chip');
    check('从后台入口能回后台', await waitFor(async () => (await path()) === '/admin', 8000));

    await evalJs('window.confirm = () => true; true');
    await click('.admin-side-foot a[href="/"]');
    check('返回前台', await waitFor(async () => (await path()) === '/', 8000));

    console.log('\n[6] 退出与红点归零');
    await evalJs('(function(){var a=[...document.querySelectorAll(".topbar-links a")].find(function(x){return x.textContent.includes("退出")});if(a)a.click();return true;})()');
    check('退出后回到登录态', await waitFor(async () => (await count('.btn-login')) === 1, 8000));
    check('退出后红点消失', (await count('.cart-badge.show')) === 0);
} finally {
    cdp.close();
}

const jsErrors = exceptions.filter((e) => !/favicon/i.test(e));
check('没有 JS 运行时异常', jsErrors.length === 0, jsErrors.join(' | '));

console.log(`\n===== E2E v3：${pass} 通过，${failures.length} 失败 =====`);
if (failures.length) {
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
}
