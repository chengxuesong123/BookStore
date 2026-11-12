/**
 * 墨香书屋 — 前端原型 Demo
 * 纯前端 + localStorage 模拟后端，不含真实接口。
 * 路由用 hash，便于直接双击 index.html 打开。
 */
(function () {
  'use strict';

  var BOOKS = window.MOCK.books;
  var CATS = window.MOCK.categories;
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');

  /* ---------------- 本地存储 ---------------- */
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  var state = {
    cart: lsGet('bs_cart', []),
    orders: lsGet('bs_orders', []),
    user: lsGet('bs_user', null),
    stock: lsGet('bs_stock', {}),
    bookStatus: lsGet('bs_book_status', {}),
    adminTab: 'books',
    qty: 1
  };
  function saveCart() { lsSet('bs_cart', state.cart); }
  function saveOrders() { lsSet('bs_orders', state.orders); }
  function saveUser() { lsSet('bs_user', state.user); }
  function saveStock() { lsSet('bs_stock', state.stock); }
  function saveBookStatus() { lsSet('bs_book_status', state.bookStatus); }

  /* ---------------- 小工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '¥' + Number(n).toFixed(2); }
  function catName(id) {
    var c = CATS.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : '其他';
  }
  function bookById(id) {
    id = Number(id);
    return BOOKS.filter(function (b) { return b.id === id; })[0] || null;
  }
  function stockOf(book) {
    return state.stock[book.id] != null ? state.stock[book.id] : book.stock;
  }
  function bookOnSale(book) {
    return state.bookStatus[book.id] !== 'off';
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  var STATUS_TEXT = { pending: '待付款', paid: '待发货', shipped: '已发货', done: '已完成', cancelled: '已取消' };
  function statusPill(s) { return '<span class="pill pill-' + s + '">' + STATUS_TEXT[s] + '</span>'; }

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
  }

  /* ---------------- 购物车 ---------------- */
  function cartCount() {
    return state.cart.reduce(function (n, l) { return n + l.qty; }, 0);
  }
  function cartLines() {
    var out = [];
    state.cart.forEach(function (l) {
      var b = bookById(l.id);
      if (b) out.push({ book: b, qty: l.qty, sum: b.price * l.qty });
    });
    return out;
  }
  function cartTotal() {
    return cartLines().reduce(function (n, l) { return n + l.sum; }, 0);
  }
  function addToCart(id, qty) {
    var b = bookById(id);
    if (!b) return;
    var left = stockOf(b);
    if (left <= 0) { toast('这本暂时缺货'); return; }
    var line = state.cart.filter(function (l) { return l.id === b.id; })[0];
    var had = line ? line.qty : 0;
    var want = had + qty;
    if (want > left) {
      want = left;
      toast('库存只够 ' + left + ' 本');
    }
    if (line) { line.qty = want; } else { state.cart.push({ id: b.id, qty: want }); }
    saveCart();
    refreshCartBadge();
    if (want > had) toast('已加入购物车');
  }
  function setQty(id, qty) {
    var b = bookById(id);
    var line = state.cart.filter(function (l) { return l.id === id; })[0];
    if (!b || !line) return;
    var limit = stockOf(b);
    if (qty > limit) { qty = limit; toast('库存只够 ' + limit + ' 本'); }
    if (qty <= 0) { removeLine(id); return; }
    line.qty = qty;
    saveCart();
    refreshCartBadge();
    render();
  }
  function removeLine(id) {
    state.cart = state.cart.filter(function (l) { return l.id !== id; });
    saveCart();
    refreshCartBadge();
    render();
  }
  function refreshCartBadge() {
    var badge = document.getElementById('cart-badge');
    var n = cartCount();
    if (!badge) return;
    badge.textContent = n;
    badge.style.display = n > 0 ? 'inline-block' : 'none';
  }

  /* ---------------- 路由 ---------------- */
  function currentRoute() {
    var raw = (location.hash || '#/').replace(/^#/, '');
    var parts = raw.split('?');
    var path = parts[0] || '/';
    var query = new URLSearchParams(parts[1] || '');
    return { path: path, query: query };
  }
  function go(hash, replace) {
    if (replace) {
      history.replaceState(null, '', '#' + hash);
      render();
    } else {
      location.hash = hash;
    }
  }
  function activeNav(path) {
    var nav = path === '/' ? '/' :
      path.indexOf('/books') === 0 || path.indexOf('/book/') === 0 ? '/books' :
        path.indexOf('/orders') === 0 || path.indexOf('/order/') === 0 ? '/orders' :
          path.indexOf('/cart') === 0 || path.indexOf('/checkout') === 0 ? '/cart' : '';
    document.querySelectorAll('.main-nav a[data-nav]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === nav);
    });
  }

  /* ---------------- 公共片段 ---------------- */
  function bookCard(b) {
    var stock = stockOf(b);
    var badge = stock <= 0 ? '<span class="stock-out">缺货</span>'
      : stock <= 3 ? '<span class="stock-low">仅剩 ' + stock + ' 本</span>' : '';
    return '<a class="book-card" href="#/book/' + b.id + '">' +
      '<div class="book-cover" style="background:' + b.cover + '">' +
      '<span class="cv-cat">' + esc(catName(b.cat)) + '</span>' +
      '<span class="cv-title">' + esc(b.title) + '</span>' +
      '</div>' +
      '<div class="book-body">' +
      '<div class="book-title">' + esc(b.title) + '</div>' +
      '<div class="book-author">' + esc(b.author) + ' · ' + esc(b.publisher) + '</div>' +
      '<div class="book-foot"><span class="price">' + money(b.price) + '</span>' + badge + '</div>' +
      '</div></a>';
  }
  function bookGrid(list) {
    if (!list.length) {
      return '<div class="empty"><h3>没有找到符合条件的书</h3><p>换个关键词或分类试试。</p></div>';
    }
    return '<div class="book-grid">' + list.map(bookCard).join('') + '</div>';
  }
  function pageHead(title, sub) {
    return '<div class="page-head"><h1>' + esc(title) + '</h1>' +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</div>';
  }
  function thumbStyle(b) {
    return 'background:' + b.cover + ';';
  }
  function orderTimeline(order) {
    if (order.status === 'cancelled') {
      return '<div class="timeline"><div class="tl-step done"><span class="tl-dot"></span>已下单</div>' +
        '<div class="tl-line"></div><div class="tl-step done" style="color:#8a3b2e"><span class="tl-dot" style="background:#8a3b2e"></span>已取消</div></div>';
    }
    var steps = ['pending', 'paid', 'shipped', 'done'];
    var idx = steps.indexOf(order.status);
    return '<div class="timeline">' + steps.map(function (s, i) {
      return '<div class="tl-step' + (i <= idx ? ' done' : '') + '"><span class="tl-dot"></span>' + STATUS_TEXT[s] + '</div>' +
        (i < steps.length - 1 ? '<div class="tl-line"></div>' : '');
    }).join('') + '</div>';
  }

  /* ---------------- 页面：首页 ---------------- */
  function viewHome() {
    var picks = BOOKS.filter(bookOnSale).slice(0, 8);
    var tiles = [
      { ico: '📚', t: BOOKS.length + ' 本精选图书', s: '文学、历史、科技、童书都有' },
      { ico: '🚚', t: '满 59 元包邮', s: '单本不满的话可以凑一凑' },
      { ico: '💵', t: '货到付款', s: 'MVP 阶段不接在线支付' }
    ];
    return '<section class="hero">' +
      '<div class="hero-main">' +
      '<h1>在墨香里，<br>找到下一本<em>要读的书</em>。</h1>' +
      '<p>一个只卖纸质书的线上小店。挑书、加购、下单，剩下的交给我们打包。</p>' +
      '<div class="hero-actions">' +
      '<a class="btn btn-primary" href="#/books">开始选书</a>' +
      '<a class="btn" href="#/orders">查看我的订单</a>' +
      '</div>' +
      '<div class="hero-mark">书</div>' +
      '</div>' +
      '<div class="hero-side">' + tiles.map(function (t) {
        return '<div class="hero-tile"><div class="ico">' + t.ico + '</div><div><strong>' + t.t + '</strong><span>' + t.s + '</span></div></div>';
      }).join('') + '</div>' +
      '</section>' +
      '<section style="margin-bottom:40px">' +
      '<div class="section-title"><h2>按分类找</h2><a href="#/books">全部图书 →</a></div>' +
      '<div class="chips">' + CATS.map(function (c) {
        return '<a class="chip" href="#/books?cat=' + c.id + '">' + esc(c.name) + '</a>';
      }).join('') + '</div>' +
      '</section>' +
      '<section>' +
      '<div class="section-title"><h2>新书上架</h2><a href="#/books">查看全部 →</a></div>' +
      bookGrid(picks) +
      '</section>';
  }

  /* ---------------- 页面：图书列表 ---------------- */
  function viewBooks(query) {
    var q = (query.get('q') || '').trim();
    var cat = query.get('cat') || '';
    var sort = query.get('sort') || 'default';

    var list = BOOKS.filter(function (b) {
      if (!bookOnSale(b)) return false;
      if (cat && b.cat !== cat) return false;
      if (q && (b.title + b.author + b.publisher).indexOf(q) < 0) return false;
      return true;
    });
    if (sort === 'price-asc') list.sort(function (a, b) { return a.price - b.price; });
    if (sort === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });

    var catChips = '<a class="chip' + (!cat ? ' active' : '') + '" href="#/books' + (q ? '?q=' + encodeURIComponent(q) : '') + '">全部</a>' +
      CATS.map(function (c) {
        var active = cat === c.id ? ' active' : '';
        var params = [];
        if (q) params.push('q=' + encodeURIComponent(q));
        params.push('cat=' + c.id);
        return '<a class="chip' + active + '" href="#/books?' + params.join('&') + '">' + esc(c.name) + '</a>';
      }).join('');

    return pageHead('全部图书', '共 ' + list.length + ' 本') +
      '<div class="toolbar">' +
      '<form class="search-box" id="search-form">' +
      '<input type="search" name="q" placeholder="搜书名、作者或出版社" value="' + esc(q) + '" aria-label="搜索图书">' +
      '<button class="btn btn-primary" type="submit">搜索</button>' +
      '</form>' +
      '<select class="select" id="sort-select" aria-label="排序">' +
      '<option value="default"' + (sort === 'default' ? ' selected' : '') + '>默认排序</option>' +
      '<option value="price-asc"' + (sort === 'price-asc' ? ' selected' : '') + '>价格从低到高</option>' +
      '<option value="price-desc"' + (sort === 'price-desc' ? ' selected' : '') + '>价格从高到低</option>' +
      '</select>' +
      '</div>' +
      '<div class="toolbar" style="padding:12px 16px">' + catChips + '</div>' +
      (q ? '<p class="result-line">关键词「' + esc(q) + '」的搜索结果</p>' : '') +
      bookGrid(list);
  }

  /* ---------------- 页面：图书详情 ---------------- */
  function viewBook(id) {
    var b = bookById(id);
    if (!b) return '<div class="empty"><h3>没有这本书</h3><p><a href="#/books">回图书列表</a></p></div>';
    var stock = stockOf(b);
    var canBuy = stock > 0 && bookOnSale(b);
    return '<div style="margin-bottom:16px"><a href="#/books" class="muted" style="font-size:13px">← 返回图书列表</a></div>' +
      '<div class="detail">' +
      '<div class="detail-cover" style="background:' + b.cover + '">' +
      '<span class="cv-cat" style="align-self:flex-start;font-size:11px;letter-spacing:.12em;padding:2px 8px;border:1px solid rgba(255,255,255,.55);border-radius:3px">' + esc(catName(b.cat)) + '</span>' +
      '<div><div class="detail-cv-title">' + esc(b.title) + '</div>' +
      '<div class="detail-cv-sub">' + esc(b.author) + '</div></div>' +
      '</div>' +
      '<div class="detail-info">' +
      '<h1>' + esc(b.title) + '</h1>' +
      '<div class="detail-meta">' + esc(b.author) + '　·　' + esc(b.publisher) + '　·　' + esc(catName(b.cat)) + '</div>' +
      '<div class="detail-price"><span class="price">' + money(b.price) + '</span>' +
      '<span class="stock">' + (stock > 0 ? '库存 ' + stock + ' 本' : '暂时缺货') + '</span></div>' +
      '<div class="buy-row">' +
      '<div class="qty"><button type="button" data-action="qty-minus">−</button>' +
      '<input type="text" id="qty-input" value="1" inputmode="numeric" aria-label="购买数量">' +
      '<button type="button" data-action="qty-plus">+</button></div>' +
      '<button class="btn btn-primary" data-action="add-cart" data-id="' + b.id + '"' + (canBuy ? '' : ' disabled') + '>加入购物车</button>' +
      '<button class="btn btn-green" data-action="buy-now" data-id="' + b.id + '"' + (canBuy ? '' : ' disabled') + '>立即购买</button>' +
      '</div>' +
      '<div class="detail-sections">' +
      '<div class="panel-box"><h3>内容简介</h3><p class="intro">' + esc(b.intro) + '</p></div>' +
      '<div class="panel-box"><h3>图书信息</h3><div class="info-list">' +
      '<div>作者<b>' + esc(b.author) + '</b></div><div>出版社<b>' + esc(b.publisher) + '</b></div>' +
      '<div>分类<b>' + esc(catName(b.cat)) + '</b></div><div>定价<b>' + money(b.price) + '</b></div>' +
      '</div></div>' +
      '</div></div></div>';
  }

  /* ---------------- 页面：购物车 ---------------- */
  function viewCart() {
    var lines = cartLines();
    if (!lines.length) {
      return pageHead('购物车') +
        '<div class="empty"><h3>购物车还是空的</h3><p>去挑几本书吧。</p><p><a class="btn btn-primary" href="#/books" style="margin-top:10px">去选书</a></p></div>';
    }
    var total = cartTotal();
    var ship = total >= 59 || total === 0 ? '免运费' : money(6);
    return pageHead('购物车', '共 ' + cartCount() + ' 件') +
      '<div class="cart-layout">' +
      '<div class="cart-list">' + lines.map(function (l) {
        var b = l.book;
        return '<div class="cart-row">' +
          '<a href="#/book/' + b.id + '" class="cart-thumb" style="' + thumbStyle(b) + '">' + esc(b.title) + '</a>' +
          '<div><div class="cart-name"><a href="#/book/' + b.id + '">' + esc(b.title) + '</a></div>' +
          '<div class="cart-author">' + esc(b.author) + '</div></div>' +
          '<div class="cart-qty-cell"><div class="qty" style="height:34px">' +
          '<button type="button" data-action="cart-minus" data-id="' + b.id + '">−</button>' +
          '<input type="text" value="' + l.qty + '" readonly aria-label="数量">' +
          '<button type="button" data-action="cart-plus" data-id="' + b.id + '">+</button>' +
          '</div></div>' +
          '<div class="cart-sum price">' + money(l.sum) + '</div>' +
          '<div class="cart-del-cell"><button class="cart-del" data-action="remove-line" data-id="' + b.id + '">删除</button></div>' +
          '</div>';
      }).join('') + '</div>' +
      '<div class="summary"><h3>结算信息</h3>' +
      '<div class="sum-row"><span>商品件数</span><b>' + cartCount() + ' 件</b></div>' +
      '<div class="sum-row"><span>商品金额</span><b>' + money(total) + '</b></div>' +
      '<div class="sum-row"><span>运费</span><b>' + ship + '</b></div>' +
      '<div class="sum-total"><span>合计</span><span class="price">' + money(total + (total >= 59 ? 0 : 6)) + '</span></div>' +
      '<button class="btn btn-primary" data-action="go-checkout">去结算</button>' +
      '<p class="note">满 59 元包邮，当前运费 ' + ship + '</p>' +
      '</div></div>';
  }

  /* ---------------- 页面：结算 ---------------- */
  function viewCheckout() {
    var lines = cartLines();
    if (!lines.length) return '<div class="empty"><h3>购物车是空的，无法结算</h3><p><a href="#/books">去选书</a></p></div>';
    var total = cartTotal();
    var ship = total >= 59 ? 0 : 6;
    return pageHead('确认订单', '核对信息后提交') +
      '<div class="cart-layout">' +
      '<div class="panel-box">' +
      '<h3>收货信息</h3>' +
      '<div class="pay-hint"><span>💵</span><div>本 Demo 不接在线支付，提交后订单为「货到付款」，进入待发货状态，可在订单页模拟付款推进流程。</div></div>' +
      '<form id="checkout-form" novalidate>' +
      '<div class="field" data-field="receiver"><label>收货人<span class="req">*</span></label>' +
      '<input name="receiver" placeholder="请输入收货人姓名" value="' + esc(state.user ? state.user.nickname : '') + '">' +
      '<div class="err">请填写收货人姓名（至少 2 个字）</div></div>' +
      '<div class="field" data-field="phone"><label>手机号<span class="req">*</span></label>' +
      '<input name="phone" placeholder="11 位手机号" inputmode="numeric" maxlength="11">' +
      '<div class="err">请输入正确的 11 位手机号</div></div>' +
      '<div class="field" data-field="address"><label>收货地址<span class="req">*</span></label>' +
      '<textarea name="address" placeholder="省 / 市 / 区 + 详细地址，例如：浙江省杭州市西湖区文三路 100 号 3 幢 501"></textarea>' +
      '<div class="err">地址至少填写 6 个字</div></div>' +
      '<div class="field" data-field="remark"><label>订单备注（选填）</label>' +
      '<input name="remark" placeholder="例如：工作日送货 / 需要发票"></div>' +
      '<button class="btn btn-primary" type="submit" style="width:100%;height:44px">提交订单</button>' +
      '</form></div>' +
      '<div class="summary"><h3>订单明细</h3>' +
      '<div class="checkout-items">' + lines.map(function (l) {
        return '<div class="checkout-item"><span>' + esc(l.book.title) + ' × ' + l.qty + '</span><span>' + money(l.sum) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="sum-row" style="margin-top:12px"><span>商品金额</span><b>' + money(total) + '</b></div>' +
      '<div class="sum-row"><span>运费</span><b>' + (ship ? money(ship) : '免运费') + '</b></div>' +
      '<div class="sum-total"><span>应付</span><span class="price">' + money(total + ship) + '</span></div>' +
      '<p class="note">提交后可在「我的订单」查看进度</p>' +
      '</div></div>';
  }

  /* ---------------- 页面：订单列表 ---------------- */
  function viewOrders() {
    if (!state.orders.length) {
      return pageHead('我的订单') +
        '<div class="empty"><h3>还没有订单</h3><p>下单后会出现在这里。</p><p><a class="btn btn-primary" href="#/books" style="margin-top:10px">去选书</a></p></div>';
    }
    return pageHead('我的订单', '共 ' + state.orders.length + ' 单') +
      state.orders.map(function (o) {
        return '<div class="order-card">' +
          '<div class="order-head"><span class="no">' + o.no + '</span>' +
          '<span>' + fmtTime(o.createdAt) + '</span>' +
          '<span class="spacer"></span>' + statusPill(o.status) + '</div>' +
          '<div class="order-body">' + o.items.map(function (it) {
            return '<div class="order-line">' +
              '<div class="thumb" style="background:' + it.cover + '"></div>' +
              '<div class="nm">' + esc(it.title) + ' <small>× ' + it.qty + '</small></div>' +
              '<div class="price">' + money(it.price * it.qty) + '</div></div>';
          }).join('') + '</div>' +
          '<div class="order-foot">' +
          '<div class="total">合计<b>' + money(o.total) + '</b></div>' +
          '<div class="order-actions">' +
          '<a class="btn btn-sm" href="#/order/' + o.id + '">订单详情</a>' +
          (o.status === 'pending' ? '<button class="btn btn-sm btn-primary" data-action="pay" data-id="' + o.id + '">模拟付款</button>' : '') +
          (o.status === 'shipped' ? '<button class="btn btn-sm btn-green" data-action="confirm-receive" data-id="' + o.id + '">确认收货</button>' : '') +
          (o.status === 'pending' ? '<button class="btn btn-sm" data-action="cancel-order" data-id="' + o.id + '">取消订单</button>' : '') +
          '</div></div></div>';
      }).join('');
  }

  /* ---------------- 页面：订单详情 ---------------- */
  function viewOrder(id) {
    var o = state.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return '<div class="empty"><h3>订单不存在</h3><p><a href="#/orders">回我的订单</a></p></div>';
    return pageHead('订单详情', o.no) +
      '<div class="detail-card">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">' + statusPill(o.status) +
      '<span class="muted" style="font-size:13px">下单时间 ' + fmtTime(o.createdAt) + '</span>' +
      '<span class="spacer" style="margin-left:auto"></span></div>' +
      orderTimeline(o) +
      (o.status === 'pending' ? '<div style="margin-top:18px"><button class="btn btn-primary" data-action="pay" data-id="' + o.id + '">模拟付款（货到付款前先走这一步演示）</button></div>' : '') +
      (o.status === 'shipped' ? '<div style="margin-top:18px"><button class="btn btn-green" data-action="confirm-receive" data-id="' + o.id + '">确认收货</button></div>' : '') +
      '</div>' +
      '<div class="detail-card"><h3>商品</h3>' + o.items.map(function (it) {
        return '<div class="order-line"><div class="thumb" style="background:' + it.cover + ';width:56px"></div>' +
          '<div class="nm">' + esc(it.title) + ' <small>' + money(it.price) + ' × ' + it.qty + '</small></div>' +
          '<div class="price">' + money(it.price * it.qty) + '</div></div>';
      }).join('') +
      '<div class="sum-total" style="margin-top:12px"><span>商品合计</span><span class="price">' + money(o.total) + '</span></div>' +
      '</div>' +
      '<div class="detail-card"><h3>收货信息</h3>' +
      '<div class="addr-grid"><div><div class="k">收货人</div><div class="v">' + esc(o.receiver) + '</div></div>' +
      '<div><div class="k">手机号</div><div class="v">' + esc(o.phone) + '</div></div>' +
      '<div style="grid-column:1/-1"><div class="k">收货地址</div><div class="v">' + esc(o.address) + '</div></div>' +
      (o.remark ? '<div style="grid-column:1/-1"><div class="k">备注</div><div class="v">' + esc(o.remark) + '</div></div>' : '') +
      '</div></div>' +
      '<div class="detail-card"><h3>支付方式</h3><p class="muted" style="margin:0;font-size:14px">货到付款（Demo 模拟，无真实支付）</p></div>';
  }

  /* ---------------- 页面：登录 ---------------- */
  function viewLogin(query) {
    var next = query.get('next') || '/orders';
    return '<div class="auth-wrap"><div class="auth-card">' +
      '<h1>登录</h1>' +
      '<p class="sub">Demo 环境，任意手机号 + 密码即可登录</p>' +
      '<form id="login-form" data-next="' + esc(next) + '" novalidate>' +
      '<div class="field" data-field="phone"><label>手机号<span class="req">*</span></label>' +
      '<input name="phone" placeholder="11 位手机号" inputmode="numeric" maxlength="11">' +
      '<div class="err">请输入 11 位手机号</div></div>' +
      '<div class="field" data-field="password"><label>密码<span class="req">*</span></label>' +
      '<input name="password" type="password" placeholder="至少 6 位">' +
      '<div class="err">密码至少 6 位</div></div>' +
      '<button class="btn btn-primary" type="submit" style="width:100%;height:44px">登录</button>' +
      '</form>' +
      '<p class="auth-tip">真实版本会接入 TP8 的登录接口与 session，这里只验证页面流程。</p>' +
      '</div></div>';
  }

  /* ---------------- 页面：后台 ---------------- */
  function viewAdmin() {
    var tab = state.adminTab;
    var head = pageHead('后台管理', '原型预览 · 数据为模拟');
    var tabs = '<div class="admin-tabs">' +
      '<button data-action="admin-tab" data-tab="books" class="' + (tab === 'books' ? 'active' : '') + '">图书管理</button>' +
      '<button data-action="admin-tab" data-tab="orders" class="' + (tab === 'orders' ? 'active' : '') + '">订单管理</button>' +
      '</div>';

    if (tab === 'books') {
      var rows = BOOKS.map(function (b) {
        var on = bookOnSale(b);
        return '<tr><td>' + b.id + '</td><td>' + esc(b.title) + '</td><td>' + esc(catName(b.cat)) + '</td>' +
          '<td>' + money(b.price) + '</td><td>' + stockOf(b) + '</td>' +
          '<td>' + (on ? '<span class="pill pill-done">已上架</span>' : '<span class="pill pill-off">已下架</span>') + '</td>' +
          '<td><div class="actions"><button class="btn btn-sm" data-action="toggle-book" data-id="' + b.id + '">' + (on ? '下架' : '上架') + '</button></div></td></tr>';
      }).join('');
      return head + tabs + '<div class="table-wrap"><table><thead><tr>' +
        '<th>ID</th><th>书名</th><th>分类</th><th>价格</th><th>库存</th><th>状态</th><th>操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    if (!state.orders.length) {
      return head + tabs + '<div class="empty"><h3>暂无订单</h3><p>前台下单后这里会实时出现（同一浏览器内）。</p></div>';
    }
    var orows = state.orders.map(function (o) {
      var ops = '';
      if (o.status === 'paid') ops += '<button class="btn btn-sm btn-primary" data-action="ship" data-id="' + o.id + '">发货</button>';
      if (o.status === 'shipped') ops += '<button class="btn btn-sm btn-green" data-action="complete" data-id="' + o.id + '">设为完成</button>';
      return '<tr><td style="font-family:ui-monospace,Consolas,monospace">' + o.no + '</td>' +
        '<td>' + esc(o.receiver) + '</td><td>' + money(o.total) + '</td>' +
        '<td>' + statusPill(o.status) + '</td><td>' + fmtTime(o.createdAt) + '</td>' +
        '<td><div class="actions"><a class="btn btn-sm" href="#/order/' + o.id + '">查看</a>' + ops + '</div></td></tr>';
    }).join('');
    return head + tabs + '<div class="table-wrap"><table><thead><tr>' +
      '<th>订单号</th><th>收货人</th><th>金额</th><th>状态</th><th>下单时间</th><th>操作</th>' +
      '</tr></thead><tbody>' + orows + '</tbody></table></div>';
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    var r = currentRoute();
    var path = r.path;
    var html = '';
    var m;

    if (path === '/' || path === '') html = viewHome();
    else if (path === '/books') html = viewBooks(r.query);
    else if ((m = path.match(/^\/book\/(\d+)$/))) html = viewBook(m[1]);
    else if (path === '/cart') html = viewCart();
    else if (path === '/checkout') {
      if (!state.user) { go('/login?next=' + encodeURIComponent('/checkout'), true); return; }
      html = viewCheckout();
    }
    else if (path === '/orders') html = viewOrders();
    else if ((m = path.match(/^\/order\/(.+)$/))) html = viewOrder(m[1]);
    else if (path === '/login') html = viewLogin(r.query);
    else if (path === '/admin') html = viewAdmin();
    else html = '<div class="empty"><h3>页面不存在</h3><p><a href="#/">回首页</a></p></div>';

    app.innerHTML = '<div class="page"><div class="wrap">' + html + '</div></div>';
    activeNav(path);
    refreshCartBadge();
    state.qty = 1;
  }

  /* ---------------- 订单操作 ---------------- */
  function findOrder(id) {
    return state.orders.filter(function (o) { return o.id === id; })[0];
  }
  function createOrder(data) {
    var lines = cartLines();
    var total = cartTotal();
    var order = {
      id: 'o' + Date.now(),
      no: 'BS' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.floor(Math.random() * 9000 + 1000),
      items: lines.map(function (l) {
        return { id: l.book.id, title: l.book.title, price: l.book.price, qty: l.qty, cover: l.book.cover };
      }),
      total: total,
      receiver: data.receiver,
      phone: data.phone,
      address: data.address,
      remark: data.remark || '',
      status: 'pending',
      createdAt: Date.now()
    };
    lines.forEach(function (l) {
      state.stock[l.book.id] = Math.max(0, stockOf(l.book) - l.qty);
    });
    saveStock();
    state.orders.unshift(order);
    saveOrders();
    state.cart = [];
    saveCart();
    return order;
  }

  /* ---------------- 事件：点击 ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');

    if (action === 'qty-minus' || action === 'qty-plus') {
      var input = document.getElementById('qty-input');
      if (!input) return;
      var v = parseInt(input.value, 10) || 1;
      v = action === 'qty-plus' ? v + 1 : v - 1;
      var b = bookById(currentRoute().path.split('/').pop());
      var limit = b ? stockOf(b) : 99;
      if (v > limit) { v = limit; toast('库存只够 ' + limit + ' 本'); }
      if (v < 1) v = 1;
      input.value = v;
      return;
    }
    if (action === 'add-cart') {
      var qi = document.getElementById('qty-input');
      addToCart(id, qi ? Math.max(1, parseInt(qi.value, 10) || 1) : 1);
      return;
    }
    if (action === 'buy-now') {
      var b2 = bookById(id);
      if (!b2) return;
      var qb = document.getElementById('qty-input');
      var qn = qb ? Math.max(1, parseInt(qb.value, 10) || 1) : 1;
      addToCart(id, qn);
      if (!state.user) { go('/login?next=' + encodeURIComponent('/checkout')); return; }
      go('/checkout');
      return;
    }
    if (action === 'cart-plus') { setQty(Number(id), (state.cart.filter(function (l) { return l.id === Number(id); })[0] || {}).qty + 1); return; }
    if (action === 'cart-minus') {
      var line = state.cart.filter(function (l) { return l.id === Number(id); })[0];
      if (line) setQty(Number(id), line.qty - 1);
      return;
    }
    if (action === 'remove-line') { removeLine(Number(id)); toast('已从购物车移除'); return; }
    if (action === 'go-checkout') {
      if (!state.user) { go('/login?next=' + encodeURIComponent('/checkout')); return; }
      go('/checkout');
      return;
    }
    if (action === 'pay') {
      var o = findOrder(id);
      if (o && o.status === 'pending') { o.status = 'paid'; saveOrders(); toast('付款成功，等待发货'); render(); }
      return;
    }
    if (action === 'cancel-order') {
      var oc = findOrder(id);
      if (oc && (oc.status === 'pending' || oc.status === 'paid')) {
        oc.status = 'cancelled';
        oc.items.forEach(function (it) {
          var bk = bookById(it.id);
          if (bk) state.stock[bk.id] = stockOf(bk) + it.qty;
        });
        saveStock(); saveOrders(); toast('订单已取消，库存已回补'); render();
      }
      return;
    }
    if (action === 'confirm-receive') {
      var or = findOrder(id);
      if (or && or.status === 'shipped') { or.status = 'done'; saveOrders(); toast('已确认收货'); render(); }
      return;
    }
    if (action === 'ship') {
      var os = findOrder(id);
      if (os && os.status === 'paid') { os.status = 'shipped'; saveOrders(); toast('已发货（模拟）'); render(); }
      return;
    }
    if (action === 'complete') {
      var od = findOrder(id);
      if (od && od.status === 'shipped') { od.status = 'done'; saveOrders(); toast('订单已完成'); render(); }
      return;
    }
    if (action === 'admin-tab') {
      state.adminTab = el.getAttribute('data-tab');
      render();
      return;
    }
    if (action === 'toggle-book') {
      var bid = Number(id);
      state.bookStatus[bid] = bookOnSale(bookById(bid)) ? 'off' : 'on';
      saveBookStatus();
      toast('已更新上架状态');
      render();
      return;
    }
    if (action === 'reset-demo') {
      ['bs_cart', 'bs_orders', 'bs_user', 'bs_stock', 'bs_book_status'].forEach(function (k) { localStorage.removeItem(k); });
      location.hash = '#/';
      location.reload();
      return;
    }
    if (action === 'logout') {
      state.user = null; saveUser(); toast('已退出登录'); render();
      return;
    }
  });

  /* ---------------- 事件：表单 ---------------- */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id === 'search-form') {
      e.preventDefault();
      var q = (form.querySelector('input[name="q"]').value || '').trim();
      var cat = currentRoute().query.get('cat') || '';
      var params = [];
      if (q) params.push('q=' + encodeURIComponent(q));
      if (cat) params.push('cat=' + cat);
      go('/books' + (params.length ? '?' + params.join('&') : ''));
      return;
    }
    if (form.id === 'login-form') {
      e.preventDefault();
      var phone = form.querySelector('input[name="phone"]').value.trim();
      var pass = form.querySelector('input[name="password"]').value;
      var ok = true;
      setFieldError(form, 'phone', !/^1[3-9]\d{9}$/.test(phone));
      setFieldError(form, 'password', pass.length < 6);
      if (!/^1[3-9]\d{9}$/.test(phone) || pass.length < 6) ok = false;
      if (!ok) return;
      state.user = { phone: phone, nickname: '书友' + phone.slice(-4) };
      saveUser();
      toast('登录成功');
      var next = form.getAttribute('data-next') || '/orders';
      go(next, true);
      return;
    }
    if (form.id === 'checkout-form') {
      e.preventDefault();
      var receiver = form.querySelector('input[name="receiver"]').value.trim();
      var phone2 = form.querySelector('input[name="phone"]').value.trim();
      var address = form.querySelector('textarea[name="address"]').value.trim();
      var remark = form.querySelector('input[name="remark"]').value.trim();
      var valid = true;
      if (receiver.length < 2) { setFieldError(form, 'receiver', true); valid = false; } else setFieldError(form, 'receiver', false);
      if (!/^1[3-9]\d{9}$/.test(phone2)) { setFieldError(form, 'phone', true); valid = false; } else setFieldError(form, 'phone', false);
      if (address.length < 6) { setFieldError(form, 'address', true); valid = false; } else setFieldError(form, 'address', false);
      if (!valid) { toast('请检查表单填写'); return; }
      if (cartLines().length === 0) { toast('购物车是空的'); go('/cart'); return; }
      var order = createOrder({ receiver: receiver, phone: phone2, address: address, remark: remark });
      toast('下单成功，订单号 ' + order.no);
      go('/order/' + order.id);
      return;
    }
  });

  function setFieldError(form, name, hasError) {
    var field = form.querySelector('[data-field="' + name + '"]');
    if (field) field.classList.toggle('has-error', !!hasError);
  }

  /* 详情页数量输入框：数字过滤 */
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'qty-input') {
      e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 2);
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'sort-select') {
      var r = currentRoute();
      var params = new URLSearchParams(r.query.toString());
      params.set('sort', e.target.value);
      go('/books?' + params.toString());
    }
    if (e.target && e.target.id === 'qty-input') {
      var v = parseInt(e.target.value, 10) || 1;
      var b = bookById(currentRoute().path.split('/').pop());
      var limit = b ? stockOf(b) : 99;
      e.target.value = Math.min(Math.max(1, v), Math.max(1, limit));
    }
  });

  /* ---------------- 启动 ---------------- */
  window.addEventListener('hashchange', render);
  render();
})();
