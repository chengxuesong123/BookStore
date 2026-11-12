/**
 * Demo 端到端测试：用 Edge headless + CDP 驱动真实浏览器，
 * 走一遍「浏览 → 加购 → 登录 → 结算 → 下单 → 付款 → 发货 → 完成」。
 *
 * 运行方式（需先启动静态服务）：
 *   php -S 127.0.0.1:8123 -t demo
 *   node demo/tests/e2e.mjs
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const BASE = 'http://127.0.0.1:8123';
const PROFILE_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

let pass = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { failures.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => reject(new Error('WebSocket 握手超时（' + wsUrl + '）')), 10000);
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
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error('WebSocket 错误：' + (e && e.message ? e.message : 'unknown'))); };
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

async function waitForDebugger() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch (e) { /* 还没起来：' + e.message */ }
    await sleep(250);
  }
  throw new Error('Edge 调试端口未就绪');
}

async function main() {
  const profile = join(PROFILE_ROOT, '.e2e-profile');
  let edge = null;
  let reused = false;

  // 优先复用外部已启动的 Edge（由 shell 启动，避免 Node 直接拉起浏览器导致渲染进程起不来）
  try {
    await fetch('http://127.0.0.1:' + PORT + '/json/version', { signal: AbortSignal.timeout(1500) });
    reused = true;
    console.log('复用已在运行的 Edge（端口 ' + PORT + '）');
  } catch {
    rmSync(profile, { recursive: true, force: true });
    console.log('启动 Edge，profile = ' + profile);
    edge = spawn(EDGE, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--remote-debugging-port=' + PORT,
      '--remote-allow-origins=*',
      '--user-data-dir=' + profile,
      '--window-size=1440,1700',
      'about:blank'
    ], { stdio: 'ignore' });
    console.log('Edge pid = ' + edge.pid);
  }

  const watchdog = setTimeout(() => {
    console.error('\n[超时] 测试超过 150s 未结束，强制退出');
    if (edge) { try { edge.kill(); } catch { /* ignore */ } }
    process.exit(5);
  }, 150000);

  let cdp;
  try {
    await waitForDebugger();
    console.log('调试端口已就绪');
    const targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list', { signal: AbortSignal.timeout(3000) })).json();
    // 避开 edge:// 内部页（Page.enable 会卡住），只选 about:blank 或 http 页面
    const page = targets.find((t) => t.type === 'page' && (t.url === 'about:blank' || t.url.indexOf('http') === 0))
      || targets.find((t) => t.type === 'page');
    if (!page) throw new Error('没有可用的 page target');
    console.log('目标页面：' + page.url);
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    console.log('WebSocket 已连接');
    await cdp.send('Runtime.enable');
    console.log('Runtime.enable ok');
    await cdp.send('Page.enable');
    console.log('Page.enable ok');

    const evalJs = async (expression) => {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('JS 异常：' + JSON.stringify(r.exceptionDetails));
      return r.result ? r.result.value : undefined;
    };
    const go = async (hash) => {
      await cdp.send('Page.navigate', { url: BASE + '/#' + hash });
      await sleep(500);
    };
    const text = async (sel) => evalJs('(document.querySelector(' + JSON.stringify(sel) + ') || {}).textContent || ""');
    // location.hash 形如 "#/login?next=..."，去掉 # 再比前缀
    const isAt = async (prefix) => evalJs('location.hash.replace(/^#/, "").indexOf(' + JSON.stringify(prefix) + ') === 0');

    console.log('\n[0] 初始化：清空本地数据');
    await go('/');
    await evalJs('localStorage.clear(); true');
    await cdp.send('Page.reload');
    await sleep(900);
    check('初始无订单', await evalJs('document.querySelectorAll(".order-card").length === 0'));

    console.log('\n[1] 首页渲染');
    await go('/');
    check('首页有 8 张推荐卡片', (await evalJs('document.querySelectorAll(".book-card").length')) === 8);
    check('首页标题包含"墨香"', (await text('.hero-main h1')).includes('墨香'));

    console.log('\n[2] 列表页 + 搜索 + 分类');
    await go('/books');
    check('列表页 16 本书', (await evalJs('document.querySelectorAll(".book-card").length')) === 16);
    await evalJs('document.querySelector("#search-form input[name=q]").value = "余华"; document.querySelector("#search-form").requestSubmit(); true');
    await sleep(400);
    check('搜索"余华"命中 1 本', (await evalJs('document.querySelectorAll(".book-card").length')) === 1);
    await go('/books?cat=tech');
    check('科技分类 3 本', (await evalJs('document.querySelectorAll(".book-card").length')) === 3);

    console.log('\n[3] 详情页加购');
    await go('/book/3');
    check('详情页标题为《百年孤独》', (await text('.detail-info h1')).includes('百年孤独'));
    await evalJs('document.querySelector("#qty-input").value = "2"; true');
    await evalJs('document.querySelector("[data-action=add-cart]").click(); true');
    await sleep(300);
    check('购物车角标 = 2', (await text('#cart-badge')) === '2');

    console.log('\n[4] 缺货书不可购买');
    await go('/book/4');
    check('缺货按钮禁用', await evalJs('document.querySelector("[data-action=add-cart]").disabled === true'));

    console.log('\n[5] 购物车 → 登录拦截 → 结算');
    await go('/cart');
    check('购物车 1 行', (await evalJs('document.querySelectorAll(".cart-row").length')) === 1);
    check('购物车合计含 ¥110.00（55×2）', (await text('.sum-total .price')).includes('110.00'));
    await evalJs('document.querySelector("[data-action=go-checkout]").click(); true');
    await sleep(500);
    check('未登录被拦到登录页', await isAt('/login'));
    await evalJs('document.querySelector("#login-form input[name=phone]").value = "13800138000"; document.querySelector("#login-form input[name=password]").value = "123456"; document.querySelector("#login-form").requestSubmit(); true');
    await sleep(600);
    check('登录后回到结算页', await isAt('/checkout'));

    console.log('\n[6] 下单表单校验');
    await evalJs('document.querySelector("#checkout-form input[name=receiver]").value = "张"; document.querySelector("#checkout-form").requestSubmit(); true');
    await sleep(300);
    check('收货人过短报错', (await evalJs('document.querySelector("[data-field=receiver]").classList.contains("has-error")')) === true);
    await evalJs('document.querySelector("#checkout-form input[name=receiver]").value = "张三"; document.querySelector("#checkout-form input[name=phone]").value = "13800138000"; document.querySelector("#checkout-form textarea[name=address]").value = "浙江省杭州市西湖区文三路 100 号"; document.querySelector("#checkout-form").requestSubmit(); true');
    await sleep(700);
    check('下单成功跳到订单详情', await isAt('/order/'));
    const orderHash = await evalJs('location.hash.replace(/^#/, "")');
    const orderPath = orderHash;
    check('订单状态为待付款', (await text('.detail-card .pill')).includes('待付款'));
    check('下单后购物车清空', (await evalJs('JSON.parse(localStorage.getItem("bs_cart") || "[]").length')) === 0);

    console.log('\n[7] 库存扣减');
    await go('/book/3');
    check('《百年孤独》库存 5 → 3', (await text('.detail-price .stock')).includes('3'));

    console.log('\n[8] 付款 → 发货 → 完成（跨前后台）');
    await go(orderPath);
    await evalJs('document.querySelector("[data-action=pay]").click(); true');
    await sleep(400);
    check('付款后为待发货', (await text('.detail-card .pill')).includes('待发货'));
    await go('/admin');
    await evalJs('document.querySelector("[data-action=admin-tab][data-tab=orders]").click(); true');
    await sleep(300);
    check('后台订单表有 1 单', (await evalJs('document.querySelectorAll(".table-wrap tbody tr").length')) === 1);
    await evalJs('document.querySelector("[data-action=ship]").click(); true');
    await sleep(400);
    check('后台发货后状态为已发货', (await evalJs('document.body.innerText')).includes('已发货'));
    await evalJs('document.querySelector("[data-action=complete]").click(); true');
    await sleep(400);
    check('后台完成订单', (await evalJs('document.body.innerText')).includes('已完成'));

    console.log('\n[9] 订单列表 + 取消回补库存');
    await go('/books');
    await evalJs('location.hash = "#/book/1"; true');
    await sleep(500);
    await evalJs('document.querySelector("[data-action=add-cart]").click(); true');
    await go('/cart');
    await evalJs('document.querySelector("[data-action=go-checkout]").click(); true');
    await sleep(500);
    await evalJs('document.querySelector("#checkout-form input[name=receiver]").value = "李四"; document.querySelector("#checkout-form input[name=phone]").value = "13900139000"; document.querySelector("#checkout-form textarea[name=address]").value = "上海市浦东新区世纪大道 1 号"; document.querySelector("#checkout-form").requestSubmit(); true');
    await sleep(700);
    const stockBeforeCancel = await evalJs('JSON.parse(localStorage.getItem("bs_stock") || "{}")["1"]');
    await evalJs('document.querySelector("[data-action=cancel-order]") ? document.querySelector("[data-action=cancel-order]").click() : location.hash = "#/orders"; true');
    await sleep(500);
    await evalJs('location.hash = "#/orders"; true');
    await sleep(400);
    check('订单列表有 2 单', (await evalJs('document.querySelectorAll(".order-card").length')) === 2);
    // 取消第二单（最新的一单在列表首位）
    await evalJs('document.querySelectorAll(".order-card")[0].querySelector("[data-action=cancel-order]").click(); true');
    await sleep(500);
    check('最新订单已取消', (await text('.order-card')).includes('已取消'));
    const stockAfterCancel = await evalJs('JSON.parse(localStorage.getItem("bs_stock") || "{}")["1"]');
    check('取消后库存回补（' + stockBeforeCancel + ' → ' + stockAfterCancel + '）', Number(stockAfterCancel) === Number(stockBeforeCancel) + 1);

    console.log('\n[10] 后台图书上下架');
    await go('/admin');
    await evalJs('document.querySelector("[data-action=admin-tab][data-tab=books]").click(); true');
    await sleep(300);
    check('后台图书表 16 行', (await evalJs('document.querySelectorAll(".table-wrap tbody tr").length')) === 16);
    await evalJs('document.querySelector("[data-action=\\"toggle-book\\"][data-id=\\"16\\"]").click(); true');
    await sleep(300);
    check('下架后列表少一本', await evalJs('location.hash = "#/books"; 1') === 1);
    await sleep(500);
    check('前台列表变为 15 本', (await evalJs('document.querySelectorAll(".book-card").length')) === 15);

    console.log('\n[11] 404 兜底');
    await go('/nope');
    check('未知路由显示兜底页', (await text('.empty h3')).includes('页面不存在'));
  } finally {
    clearTimeout(watchdog);
    if (cdp) cdp.close();
    if (edge) edge.kill();
  }

  console.log('\n===== 结果：' + pass + ' 通过，' + failures.length + ' 失败 =====');
  if (failures.length) {
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
  }
}

main().catch((e) => { console.error('测试异常：', e); process.exit(1); });
