/**
 * 截图脚本：连接已启动的 Edge（CDP），逐页截图并收集 JS 异常。
 * 用法：node demo/tests/shots.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 9333;
const BASE = 'http://127.0.0.1:8123';
const OUT = join(fileURLToPath(new URL('..', import.meta.url)), 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && (t.url === 'about:blank' || t.url.startsWith('http'))) || list.find((t) => t.type === 'page');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const errors = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  }
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
  }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result ? r.result.value : undefined;
};
const go = async (hash) => { await send('Page.navigate', { url: BASE + '/#' + hash }); await sleep(900); };

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

async function shot(name) {
  await sleep(500);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = join(OUT, name + '.png');
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('saved ' + name + '.png');
}

// 干净的初始状态
await go('/');
await evalJs('localStorage.clear(); true');
await send('Page.reload');
await sleep(900);

await go('/'); await shot('home');
await go('/books'); await shot('books');
await go('/book/3'); await shot('detail');
await evalJs('document.querySelector("[data-action=add-cart]").click(); true');
await go('/cart'); await shot('cart');
await go('/login'); await shot('login');
await go('/register'); await shot('register');

// 管理员登录后截图
await go('/login');
await evalJs('document.querySelector("#login-form input[name=email]").value = "admin@moyu.com"; document.querySelector("#login-form input[name=password]").value = "admin123"; true');
await evalJs('document.querySelector("#login-form").requestSubmit(); true');
await sleep(1200);
await shot('admin');

console.log(errors.length ? '发现 JS 异常：\n' + errors.join('\n') : '无 JS 异常');
ws.close();
process.exit(0);
