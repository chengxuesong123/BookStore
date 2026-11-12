/**
 * E2E：Edge headless + CDP 驱动真实浏览器
 * 覆盖：注册 / 登录 / 权限 / 购物 / 下单 / 后台流转
 *
 * 运行前：
 *   php -S 127.0.0.1:8123 -t demo
 *   msedge --headless=new --remote-debugging-port=9333 --remote-allow-origins=* \
 *          --user-data-dir=<workspace>/demo/.e2e-profile about:blank
 *   node demo/tests/e2e.mjs
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const BASE = 'http://127.0.0.1:8123';
const PROFILE = join(fileURLToPath(new URL('..', import.meta.url)), '.e2e-profile');

let pass = 0;
const failures = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { failures.push(name); console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => reject(new Error('WebSocket 连接超时')), 10000);
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket 错误')); };
    ws.onopen = () => { clearTimeout(timer); resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const id = ++seq;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      close() { ws.close(); }
    }); };
  });
}

async function ensureDebugger() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(1200) });
      if (r.ok) return;
    } catch { /* 未就绪 */ }
    await sleep(250);
  }
  throw new Error('调试端口未就绪，请先手动启动 Edge');
}

async function main() {
  let edge = null;
  try {
    await ensureDebugger();
    console.log('复用运行中的 Edge');
  } catch (e) {
    rmSync(PROFILE, { recursive: true, force: true });
    console.log('自行启动 Edge');
    edge = spawn(EDGE, [
      '--headless=new', '--disable-gpu', '--no-first-run',
      '--remote-debugging-port=' + PORT, '--remote-allow-origins=*',
      '--user-data-dir=' + PROFILE, '--window-size=1440,1700', 'about:blank'
    ], { stdio: 'inherit' });
    await ensureDebugger();
  }

  const targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list', { signal: AbortSignal.timeout(3000) })).json();
  const page = targets.find((t) => t.type === 'page' && (t.url === 'about:blank' || t.url.startsWith('http')))
    || targets.find((t) => t.type === 'page');
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  const evalJs = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('JS 异常：' + (r.exceptionDetails.exception?.description || ''));
    return r.result ? r.result.value : undefined;
  };
  const go = async (hash) => { await cdp.send('Page.navigate', { url: BASE + '/#' + hash }); await sleep(450); };
  const isAt = async (prefix) => evalJs('location.hash.replace(/^#/, "").indexOf(' + JSON.stringify(prefix) + ') === 0');
  const text = async (sel) => evalJs('(document.querySelector(' + JSON.stringify(sel) + ') || {}).textContent || ""');
  const count = async (sel) => evalJs('document.querySelectorAll(' + JSON.stringify(sel) + ').length');
  const set = async (sel, val) => evalJs('document.querySelector(' + JSON.stringify(sel) + ').value = ' + JSON.stringify(val) + '; true');
  const click = async (sel) => evalJs('document.querySelector(' + JSON.stringify(sel) + ').click(); true');
  const submit = async (sel) => evalJs('document.querySelector(' + JSON.stringify(sel) + ').requestSubmit(); true');

  try {
    /* ---------- 0. 初始化 ---------- */
    console.log('\n[0] 初始化');
    await go('/');
    await evalJs('localStorage.clear(); true');
    await cdp.send('Page.reload');
    await sleep(900);
    check('jQuery 4 已加载', await evalJs('typeof jQuery === "function" && jQuery.fn.jquery.indexOf("4.") === 0'));
    check('首页渲染 16 张书卡', (await count('.book-card')) === 16);
    check('导航没有后台入口', (await count('.main-nav a')) === 3 && !(await text('.main-nav')).includes('后台'));
    check('顶栏显示登录入口', (await text('#header-auth')).includes('登录'));

    /* ---------- 1. 登录页 → 注册入口 ---------- */
    console.log('\n[1] 登录页与注册入口');
    await go('/login');
    check('登录页有注册链接', (await evalJs('document.querySelectorAll(\'a[href^="#/register"]\').length')) >= 1);
    check('登录页提示管理员账号', (await text('.auth-hint')).includes('admin@moyu.com'));
    await click('a[href^="#/register"]');
    await sleep(450);
    check('点击后跳到注册页', await isAt('/register'));
    check('注册页是邮箱字段', (await evalJs('document.querySelector("#register-form input[name=email]").type')) === 'email');

    /* ---------- 2. 注册校验 ---------- */
    console.log('\n[2] 注册校验');
    await set('#register-form input[name=email]', 'not-an-email');
    await set('#register-form input[name=nickname]', '小');
    await set('#register-form input[name=password]', '123');
    await set('#register-form input[name=confirm]', '456');
    await submit('#register-form');
    await sleep(300);
    check('邮箱格式报错', await evalJs('document.querySelector(\'[data-field="email"]\').classList.contains("has-error")'));
    check('昵称过短报错', await evalJs('document.querySelector(\'[data-field="nickname"]\').classList.contains("has-error")'));
    check('密码不一致报错', await evalJs('document.querySelector(\'[data-field="confirm"]\').classList.contains("has-error")'));

    /* ---------- 3. 正常注册 ---------- */
    console.log('\n[3] 注册成功');
    await set('#register-form input[name=email]', 'reader@test.com');
    await set('#register-form input[name=nickname]', '小鱼');
    await set('#register-form input[name=password]', 'test123456');
    await set('#register-form input[name=confirm]', 'test123456');
    await submit('#register-form');
    await sleep(700);
    check('注册后自动登录', (await text('#header-auth')).includes('小鱼'));
    check('顶栏变成退出登录', (await text('#topbar-auth')).includes('退出'));

    /* ---------- 4. 重复注册拦截 ---------- */
    console.log('\n[4] 重复邮箱');
    await go('/register');
    await set('#register-form input[name=email]', 'reader@test.com');
    await set('#register-form input[name=nickname]', '小鱼二号');
    await set('#register-form input[name=password]', 'test123456');
    await set('#register-form input[name=confirm]', 'test123456');
    await submit('#register-form');
    await sleep(400);
    check('重复邮箱被拦下', await evalJs('document.querySelector(\'[data-field="email"]\').classList.contains("has-error")'));

    /* ---------- 5. 顾客访问后台被拒 ---------- */
    console.log('\n[5] 顾客无后台权限');
    await go('/admin');
    await sleep(700);
    check('被重定向回首页', await isAt('/'));
    check('后台表格未出现', (await count('.table-wrap')) === 0);

    /* ---------- 6. 登录校验 ---------- */
    console.log('\n[6] 登录校验');
    await evalJs('document.querySelector("[data-action=logout]").click(); true');
    await sleep(500);
    await go('/login');
    await set('#login-form input[name=email]', 'reader@test.com');
    await set('#login-form input[name=password]', 'wrongpass');
    await submit('#login-form');
    await sleep(400);
    check('错误密码提示', (await text('#toast')).includes('密码'));
    await set('#login-form input[name=password]', 'test123456');
    await submit('#login-form');
    await sleep(600);
    check('正确密码登录成功', (await text('#header-auth')).includes('小鱼'));

    /* ---------- 7. 管理员登录 ---------- */
    console.log('\n[7] 管理员登录');
    await go('/login');
    await set('#login-form input[name=email]', 'admin@moyu.com');
    await set('#login-form input[name=password]', 'admin123');
    await submit('#login-form');
    await sleep(800);
    check('管理员自动进入后台', await isAt('/admin'));
    check('后台标题正确', (await text('.admin-head h1')).includes('后台管理'));
    check('后台统计 4 张卡', (await count('.stat-card')) === 4);
    await evalJs('document.querySelector("[data-action=logout]").click(); true');
    await sleep(500);

    /* ---------- 8. 顾客购物流程 ---------- */
    console.log('\n[8] 加购 → 结算 → 下单');
    await go('/login');
    await set('#login-form input[name=email]', 'reader@test.com');
    await set('#login-form input[name=password]', 'test123456');
    await submit('#login-form');
    await sleep(600);
    await go('/book/3');
    await set('#qty-input', '2');
    await click('[data-action=add-cart]');
    await sleep(300);
    check('购物车角标为 2', (await text('#cart-badge')) === '2');
    await go('/book/4');
    check('《围城》缺货按钮禁用', await evalJs('document.querySelector("[data-action=add-cart]").disabled === true'));
    await go('/cart');
    check('购物车一行', (await count('.cart-row')) === 1);
    await click('[data-action=go-checkout]');
    await sleep(500);
    check('已登录直接进结算', await isAt('/checkout'));
    await set('#checkout-form input[name=receiver]', '张');
    await submit('#checkout-form');
    await sleep(300);
    check('收货人过短报错', await evalJs('document.querySelector(\'[data-field="receiver"]\').classList.contains("has-error")'));
    await set('#checkout-form input[name=receiver]', '小鱼');
    await set('#checkout-form input[name=phone]', '13800138000');
    await set('#checkout-form textarea[name=address]', '浙江省杭州市西湖区文三路 100 号');
    await submit('#checkout-form');
    await sleep(800);
    check('下单跳到订单详情', await isAt('/order/'));
    check('初始状态待付款', (await text('.detail-card .pill')).includes('待付款'));
    check('下单后购物车清空', (await evalJs('JSON.parse(localStorage.getItem("bs_cart") || "[]").length')) === 0);
    await click('[data-action=pay]');
    await sleep(400);
    check('付款后待发货', (await text('.detail-card .pill')).includes('待发货'));

    /* ---------- 9. 后台发货 → 完成 ---------- */
    console.log('\n[9] 后台发货');
    await evalJs('document.querySelector("[data-action=logout]").click(); true');
    await sleep(500);
    await go('/login');
    await set('#login-form input[name=email]', 'admin@moyu.com');
    await set('#login-form input[name=password]', 'admin123');
    await submit('#login-form');
    await sleep(800);
    check('后台订单表 1 条', (await count('.table-wrap tbody tr')) === 1);
    await click('[data-action=ship]');
    await sleep(500);
    check('发货后状态已发货', (await text('.table-wrap')).includes('已发货'));
    await click('[data-action=complete]');
    await sleep(500);
    check('完成后状态已完成', (await text('.table-wrap')).includes('已完成'));

    /* ---------- 10. 图书上下架 ---------- */
    console.log('\n[10] 图书下架');
    await click('[data-action=admin-tab][data-tab=books]');
    await sleep(400);
    check('图书表 18 行', (await count('.table-wrap tbody tr')) === 18);
    await click('[data-action=toggle-book][data-id="16"]');
    await sleep(400);
    await go('/books');
    check('前台在售变 17 本', (await count('.book-card')) === 17);

    /* ---------- 11. 取消订单回补库存 ---------- */
    console.log('\n[11] 取消订单');
    await evalJs('document.querySelector("[data-action=logout]").click(); true');
    await sleep(400);
    await go('/login');
    await set('#login-form input[name=email]', 'reader@test.com');
    await set('#login-form input[name=password]', 'test123456');
    await submit('#login-form');
    await sleep(600);
    await go('/book/1');
    await click('[data-action=add-cart]');
    await sleep(300);
    await go('/cart');
    await click('[data-action=go-checkout]');
    await sleep(500);
    await set('#checkout-form input[name=receiver]', '小鱼');
    await set('#checkout-form input[name=phone]', '13800138000');
    await set('#checkout-form textarea[name=address]', '上海市浦东新区世纪大道 1 号');
    await submit('#checkout-form');
    await sleep(800);
    const stockBefore = await evalJs('JSON.parse(localStorage.getItem("bs_stock") || "{}")["1"]');
    await go('/orders');
    check('订单列表 2 单', (await count('.order-card')) === 2);
    await click('.order-card [data-action=cancel-order]');
    await sleep(500);
    check('出现已取消状态', (await text('.order-card')).includes('已取消'));
    const stockAfter = await evalJs('JSON.parse(localStorage.getItem("bs_stock") || "{}")["1"]');
    check('取消回补库存（' + stockBefore + ' → ' + stockAfter + '）', Number(stockAfter) === Number(stockBefore) + 1);

    /* ---------- 12. 兜底 ---------- */
    console.log('\n[12] 兜底');
    await go('/nope');
    check('404 页面', (await text('.empty h3')).includes('页面不存在'));
  } finally {
    cdp.close();
    if (edge) edge.kill();
  }

  console.log('\n===== 结果：' + pass + ' 通过，' + failures.length + ' 失败 =====');
  if (failures.length) { failures.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
}

main().catch((e) => { console.error('测试异常：', e); process.exit(1); });
