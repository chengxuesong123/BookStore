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
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const evalJs = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('JS 异常：' + (r.exceptionDetails.exception?.description || ''));
    return r.result ? r.result.value : undefined;
};
const go = async (path) => { await cdp.send('Page.navigate', { url: BASE + path }); await sleep(700); };
const text = async (sel) => evalJs(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const count = async (sel) => evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);

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
} finally {
    cdp.close();
}

const jsErrors = exceptions.filter((e) => !/favicon/i.test(e));
check('没有 JS 运行时异常', jsErrors.length === 0, jsErrors.join(' | '));

console.log(`\n===== 结果：${pass} 通过，${failures.length} 失败 =====`);
if (failures.length) { failures.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
