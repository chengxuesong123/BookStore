/**
 * 端到端测试：真实 Edge（CDP）+ 真实 TP8 服务端
 *
 * 前置：
 *   1. php -S 127.0.0.1:8124 -t public public/router.php
 *   2. Edge --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir=<repo>/tests/.edge-profile
 *
 * 运行：node tests/e2e.mjs [--reset]
 *   --reset 先执行 php think db:init --seed --force 重置数据库（会删表）
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 9333;
const BASE = process.env.BASE || 'http://127.0.0.1:8124';
const PHP = 'D:\\wamp\\webserve\\phpstudy_pro\\Extensions\\php\\php8.3nts\\php.exe';

let pass = 0;
const failures = [];
const exceptions = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, cond, detail) {
    if (cond) { pass++; console.log('  PASS  ' + name); }
    else { failures.push(name); console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

if (process.argv.includes('--reset')) {
    console.log('重置数据库…');
    const r = spawnSync(PHP, ['think', 'db:init', '--seed', '--force'], { cwd: ROOT, stdio: 'inherit' });
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
                        pending.set(id, { res, rej });
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
const go = async (path) => { await cdp.send('Page.navigate', { url: BASE + path }); await sleep(700); };
const text = async (sel) => evalJs(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const count = async (sel) => evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const click = async (sel) => { await evalJs(`document.querySelector(${JSON.stringify(sel)}).click(); true`); };
const setVal = async (sel, val) => { await evalJs(`document.querySelector(${JSON.stringify(sel)}).value = ${JSON.stringify(val)}; true`); };
const submit = async (sel) => { await evalJs(`document.querySelector(${JSON.stringify(sel)}).requestSubmit(); true`); };

try {
    console.log('\n[1] 首页与公共布局');
    await go('/');
    check('首页 200 且渲染标题', (await evalJs('document.title')).includes('墨屿书屋'));
    check('jQuery 已加载', await evalJs('typeof jQuery === "function"'));
    check('导航 3 个入口', (await count('.main-nav a')) === 3);
    check('导航不含后台入口', !(await text('.main-nav')).includes('后台'));
    check('首页 16 张书卡（新书 8 + 热销 8）', (await count('.book-card')) === 16);
    check('分类精选 3 张卡', (await count('.promo-card')) === 3);
    check('服务承诺条存在', (await count('.feature-strip .feature')) === 4);
    check('页脚存在', (await count('.site-footer .footer-col')) === 3);
    check('未登录显示登录入口', (await text('.btn-login')).includes('登录'));
    check('购物车角标为空', (await text('#cart-badge')).trim() === '');
    check('价格显示格式化', (await text('.book-card .price')).startsWith('¥'));

    console.log('\n[2] 静态资源');
    check('样式表已生效', await evalJs('getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)"'));
    check('内容宽度受 .wrap 约束', await evalJs('Math.round(document.querySelector(".wrap").getBoundingClientRect().width) <= 1200'));
    check('桌面无横向溢出', await evalJs('document.documentElement.scrollWidth - document.documentElement.clientWidth === 0'));
    console.log('\n[3] 登录页与注册入口');
    await go('/login');
    check('登录页有注册链接', (await count('a[href^="/register"]')) >= 1);
    check('登录页提示管理员账号', (await text('.auth-hint')).includes('admin@moyu.com'));
    await click('a[href^="/register"]');
    await sleep(700);
    check('点击后到注册页', (await evalJs('location.pathname')) === '/register');
    check('注册字段是 email 类型', (await evalJs('document.querySelector("#register-form input[name=email]").type')) === 'email');

    console.log('\n[4] 注册校验');
    await setVal('#register-form input[name=email]', 'not-an-email');
    await setVal('#register-form input[name=nickname]', '小');
    await setVal('#register-form input[name=password]', '123');
    await setVal('#register-form input[name=confirm]', '456');
    await submit('#register-form');
    await sleep(1200);
    check('邮箱格式报错', await evalJs('document.querySelector(\'[data-field="email"]\').classList.contains("has-error")'));
    check('昵称过短报错', await evalJs('document.querySelector(\'[data-field="nickname"]\').classList.contains("has-error")'));
    check('两次密码不一致报错', await evalJs('document.querySelector(\'[data-field="confirm"]\').classList.contains("has-error")'));
    check('邮箱输入被回填', (await evalJs('document.querySelector("#register-form input[name=email]").value')) === 'not-an-email');

    console.log('\n[5] 注册成功');
    await setVal('#register-form input[name=email]', 'reader@test.com');
    await setVal('#register-form input[name=nickname]', '小鱼');
    await setVal('#register-form input[name=password]', 'test123456');
    await setVal('#register-form input[name=confirm]', 'test123456');
    await submit('#register-form');
    await sleep(1200);
    check('注册后回到首页', (await evalJs('location.pathname')) === '/');
    check('顶栏显示昵称', (await text('.topbar-links')).includes('小鱼'));
    check('登录按钮变昵称', (await text('.btn-login')).includes('小鱼'));

    console.log('\n[6] 重复邮箱');
    await click('a[href="/logout"]');
    await sleep(900);
    await go('/register');
    await setVal('#register-form input[name=email]', 'reader@test.com');
    await setVal('#register-form input[name=nickname]', '小鱼二号');
    await setVal('#register-form input[name=password]', 'test123456');
    await setVal('#register-form input[name=confirm]', 'test123456');
    await submit('#register-form');
    await sleep(1200);
    check('重复邮箱被拦下', await evalJs('document.querySelector(\'[data-field="email"]\').classList.contains("has-error")'));
    check('重复邮箱提示文案', (await text('#toast')).includes('已注册'));

    console.log('\n[7] 后台访问控制');
    await go('/admin');
    await sleep(700);
    check('未登录访问后台跳登录页', (await evalJs('location.pathname')) === '/login');
    check('跳转带上后台参数', (await evalJs('location.search')).includes('admin=1'));
    check('登录页提示仅管理员', await evalJs('document.querySelector(".admin-note").classList.contains("show")'));

    await setVal('#login-form input[name=email]', 'reader@test.com');
    await setVal('#login-form input[name=password]', 'test123456');
    await submit('#login-form');
    await sleep(1200);
    await go('/admin');
    await sleep(700);
    check('顾客访问后台被重定向回首页', (await evalJs('location.pathname')) === '/');
    check('提示无后台权限', (await text('#toast')).includes('没有后台权限'));
    check('后台统计未渲染', (await count('.stat-card')) === 0);

    console.log('\n[8] 退出与登录校验');
    await click('a[href="/logout"]');
    await sleep(900);
    check('退出后显示登录', (await text('.btn-login')).includes('登录'));
    await go('/login');
    await setVal('#login-form input[name=email]', 'reader@test.com');
    await setVal('#login-form input[name=password]', 'wrongpass');
    await submit('#login-form');
    await sleep(1200);
    check('错误密码字段报错', await evalJs('document.querySelector(\'[data-field="password"]\').classList.contains("has-error")'));
    check('错误密码不区分账号存在与否', (await text('#toast')).includes('邮箱或密码不正确'));
    await setVal('#login-form input[name=password]', 'test123456');
    await submit('#login-form');
    await sleep(1200);
    check('正确密码登录成功', (await text('.btn-login')).includes('小鱼'));

    console.log('\n[9] 管理员登录进后台');
    await click('a[href="/logout"]');
    await sleep(900);
    await go('/login?admin=1');
    check('带 admin 参数时提示管理员入口', await evalJs('document.querySelector(".admin-note").classList.contains("show")'));
    await setVal('#login-form input[name=email]', 'admin@moyu.com');
    await setVal('#login-form input[name=password]', 'admin123');
    await submit('#login-form');
    await sleep(1200);
    check('管理员登录后到 /admin', (await evalJs('location.pathname')) === '/admin');
    check('后台标题存在', (await text('.admin-head h1')).includes('后台管理'));
    check('后台统计 4 张卡', (await count('.stat-card')) === 4);
    check('后台显示管理员身份', (await text('.admin-head .who')).includes('admin@moyu.com'));
} finally {
    cdp.close();
}

const jsErrors = exceptions.filter((e) => !/favicon/i.test(e));
check('没有 JS 运行时异常', jsErrors.length === 0, jsErrors.join(' | '));

console.log(`\n===== 结果：${pass} 通过，${failures.length} 失败 =====`);
if (failures.length) { failures.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
