/**
 * 墨屿书屋 — 前端原型 Demo（jQuery 4）
 * 纯前端 + localStorage 模拟后端；hash 路由，便于直接打开。
 *
 * 角色：
 *   - 顾客：注册 / 登录，可下单
 *   - 管理员：admin@moyu.com / admin123，登录后才可进入 #/admin
 */
(function ($) {
  'use strict';

  var BOOKS = window.MOCK.books;
  var CATS = window.MOCK.categories;
  var ADMIN = { email: 'admin@moyu.com', password: 'admin123', role: 'admin', nickname: '店长' };

  /* ================= 存储 ================= */
  function lsGet(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  var state = {
    users: lsGet('bs_users', []),
    session: lsGet('bs_session', null),
    cart: lsGet('bs_cart', []),
    orders: lsGet('bs_orders', []),
    stock: lsGet('bs_stock', {}),
    bookStatus: lsGet('bs_book_status', {}),
    adminTab: 'orders'
  };
  function saveAll() {
    lsSet('bs_users', state.users);
    lsSet('bs_session', state.session);
    lsSet('bs_cart', state.cart);
    lsSet('bs_orders', state.orders);
    lsSet('bs_stock', state.stock);
    lsSet('bs_book_status', state.bookStatus);
  }

  /* ================= 工具 ================= */
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
  function stockOf(b) { return state.stock[b.id] != null ? state.stock[b.id] : b.stock; }
  function onSale(b) { return state.bookStatus[b.id] !== 'off'; }
  function fmtTime(ts) {
    var d = new Date(ts), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  var STATUS = { pending: '待付款', paid: '待发货', shipped: '已发货', done: '已完成', cancelled: '已取消' };
  function pill(s) { return '<span class="pill pill-' + s + '">' + STATUS[s] + '</span>'; }

  var toastTimer = null;
  function toast(msg) {
    var $t = $('#toast');
    $t.text(msg).addClass('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $t.removeClass('show'); }, 2200);
  }

  /* ================= 账号 ================= */
  function isAdmin() { return !!(state.session && state.session.role === 'admin'); }

  function findUser(email) {
    email = String(email || '').trim().toLowerCase();
    if (email === ADMIN.email) return ADMIN;
    return state.users.filter(function (u) { return u.email === email; })[0] || null;
  }

  function login(email, password) {
    var user = findUser(email);
    if (!user || user.password !== password) return null;
    state.session = { email: user.email, role: user.role, nickname: user.nickname };
    saveAll();
    return state.session;
  }

  function register(email, nickname, password) {
    email = email.trim().toLowerCase();
    state.users.push({ email: email, nickname: nickname.trim(), password: password, role: 'customer', createdAt: Date.now() });
    state.session = { email: email, role: 'customer', nickname: nickname.trim() };
    saveAll();
  }

  function logout() {
    state.session = null;
    saveAll();
    syncChrome();
    toast('已退出登录');
    render();
  }

  /* ================= 购物车 ================= */
  function cartLines() {
    var out = [];
    state.cart.forEach(function (l) {
      var b = bookById(l.id);
      if (b) out.push({ book: b, qty: l.qty, sum: b.price * l.qty });
    });
    return out;
  }
  function cartCount() { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); }
  function cartTotal() { return cartLines().reduce(function (n, l) { return n + l.sum; }, 0); }
  function shipFee(total) { return total >= 59 || total === 0 ? 0 : 6; }

  function addToCart(id, qty) {
    var b = bookById(id);
    if (!b) return;
    var left = stockOf(b);
    if (left <= 0) { toast('这本暂时缺货'); return; }
    var line = state.cart.filter(function (l) { return l.id === b.id; })[0];
    var had = line ? line.qty : 0;
    var want = Math.min(had + qty, left);
    if (want === had) { toast('库存只够 ' + left + ' 本'); return; }
    if (line) line.qty = want; else state.cart.push({ id: b.id, qty: want });
    saveAll();
    syncChrome(true);
    toast(want > had ? '已加入购物车' : '已更新购物车');
  }
  function setQty(id, qty) {
    var b = bookById(id);
    var line = state.cart.filter(function (l) { return l.id === Number(id); })[0];
    if (!b || !line) return;
    var limit = stockOf(b);
    if (qty > limit) { qty = limit; toast('库存只够 ' + limit + ' 本'); }
    if (qty <= 0) { removeLine(id); return; }
    line.qty = qty;
    saveAll();
    syncChrome();
    render();
  }
  function removeLine(id) {
    state.cart = state.cart.filter(function (l) { return l.id !== Number(id); });
    saveAll();
    syncChrome();
    render();
  }

  /* ================= 顶栏同步 ================= */
  function syncChrome(pop) {
    var n = cartCount();
    var $badge = $('#cart-badge');
    $badge.text(n).toggle(n > 0);
    if (pop) {
      $badge.removeClass('pop');
      void $badge[0].offsetWidth;
      $badge.addClass('pop');
    }
    if (state.session) {
      $('#header-auth-text').text(state.session.nickname);
      $('#header-auth').attr('href', '#/orders').addClass('logged-in');
      $('#topbar-auth').text('退出登录').attr('data-action', 'logout').attr('href', 'javascript:;');
    } else {
      $('#header-auth-text').text('登录');
      $('#header-auth').attr('href', '#/login').removeClass('logged-in');
      $('#topbar-auth').text('登录 / 注册').removeAttr('data-action').attr('href', '#/login');
    }
  }

  /* ================= 路由 ================= */
  function route() {
    var raw = (location.hash || '#/').replace(/^#/, '');
    var parts = raw.split('?');
    return { path: parts[0] || '/', query: new URLSearchParams(parts[1] || '') };
  }
  function go(hash) { location.hash = hash; }
  function replace(hash) {
    history.replaceState(null, '', '#' + hash);
    render();
  }

  /* ================= 组件片段 ================= */
  function bookCard(b) {
    var left = stockOf(b);
    var tag = left <= 0 ? '<span class="stock-out">缺货</span>'
      : left <= 3 ? '<span class="stock-low">仅剩 ' + left + ' 本</span>' : '<span class="stock-low" style="color:#94a3b8">现货</span>';
    return '<a class="book-card" href="#/book/' + b.id + '">' +
      '<div class="book-cover" style="background:' + b.cover + '">' +
        '<span class="cv-cat">' + esc(catName(b.cat)) + '</span>' +
        '<span class="cv-title">' + esc(b.title) + '</span>' +
      '</div>' +
      '<div class="book-body">' +
        '<div class="book-title">' + esc(b.title) + '</div>' +
        '<div class="book-author">' + esc(b.author) + ' · ' + esc(b.publisher) + '</div>' +
        '<div class="book-foot">' +
          '<div><span class="price">' + money(b.price) + '</span><span class="price-old">' + money(b.original) + '</span></div>' +
          tag +
        '</div>' +
      '</div></a>';
  }
  function bookGrid(list) {
    if (!list.length) return '<div class="empty"><div class="empty-ico">🔍</div><h3>没有找到符合条件的书</h3><p>换个关键词或分类试试。</p></div>';
    return '<div class="book-grid">' + list.map(bookCard).join('') + '</div>';
  }
  function pageHead(title, sub) {
    return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div></div>';
  }
  function revealCards() {
    $('.book-card').each(function (i) {
      var el = this;
      setTimeout(function () { $(el).addClass('in'); }, Math.min(i * 55, 600));
    });
    $('.reveal').each(function (i) {
      var el = this;
      setTimeout(function () { $(el).addClass('in'); }, 80 + Math.min(i * 90, 500));
    });
  }

  /* ================= 首页 ================= */
  function feature(ico, t, s) {
    return '<div class="feature"><div class="ico">' + ico + '</div><div><strong>' + t + '</strong><span>' + s + '</span></div></div>';
  }

  function viewHome() {
    var picks = BOOKS.filter(onSale).slice(0, 8);
    var hot = BOOKS.filter(onSale).slice(4, 12);
    var promos = [
      { cls: 'promo-mint', badge: '热销', title: '治愈系书架', desc: '把日子过慢一点，从一本小书开始。', cat: 'lit', btn: '去逛逛' },
      { cls: 'promo-peach', badge: '新到', title: '历史也可以很好看', desc: '从万历十五年到明朝那些事儿。', cat: 'hist', btn: '看看历史' },
      { cls: 'promo-sky', badge: '精选', title: '程序员的枕边书', desc: 'CSAPP、整洁之道，一本都别少。', cat: 'tech', btn: '挑技术书' }
    ];
    var promoHtml = promos.map(function (p) {
      var b = BOOKS.filter(function (x) { return x.cat === p.cat; })[0];
      return '<a class="promo-card ' + p.cls + '" href="#/books?cat=' + p.cat + '">' +
        '<span class="promo-badge">' + p.badge + '</span>' +
        '<div><h3>' + p.title + '</h3><p>' + p.desc + '</p></div>' +
        '<span class="btn btn-ghost btn-sm">' + p.btn + '</span>' +
        '<div class="mini-book" style="background:' + b.cover + '"></div>' +
        '</a>';
    }).join('');

    return '' +
      '<section class="hero">' +
        '<div class="hero-copy">' +
          '<span class="hero-eyebrow"><i></i>2026 秋季书单已上架</span>' +
          '<h1>翻开一本书，<br>进入<em>另一种人生</em>。</h1>' +
          '<p>十八本精选纸书，从文学到技术，从历史到童书。挑一本，慢慢读。</p>' +
          '<div class="hero-actions">' +
            '<a class="btn btn-primary" href="#/books">开始选书</a>' +
            '<a class="btn btn-ghost" href="#/books?cat=tech">看技术书</a>' +
          '</div>' +
          '<div class="hero-stats">' +
            '<div><strong>18</strong><span>本精选图书</span></div>' +
            '<div><strong>59 元</strong><span>全场包邮门槛</span></div>' +
            '<div><strong>48h</strong><span>下单发货</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="hero-books">' +
          '<div class="book-float b1" style="background:' + BOOKS[2].cover + '"><span class="bf-cat">诺奖作品</span><span class="bf-title">' + esc(BOOKS[2].title) + '</span></div>' +
          '<div class="book-float b2" style="background:' + BOOKS[4].cover + '"><span class="bf-cat">历史</span><span class="bf-title">' + esc(BOOKS[4].title) + '</span></div>' +
          '<div class="book-float b3" style="background:' + BOOKS[0].cover + '"><span class="bf-cat">文学</span><span class="bf-title">' + esc(BOOKS[0].title) + '</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="section reveal">' +
        '<div class="section-head"><div><h2>分类精选</h2><p>不知道读什么？从这四类开始。</p></div><a class="more" href="#/books">全部图书</a></div>' +
        '<div class="promo-grid">' + promoHtml + '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section-head"><div><h2>新书上架</h2><p>本周刚到的八本。</p></div><a class="more" href="#/books">查看全部</a></div>' +
        bookGrid(picks) +
      '</section>' +

      '<section class="section">' +
        '<div class="section-head"><div><h2>热销榜</h2><p>大家都在读。</p></div><a class="more" href="#/books?sort=price-asc">按价格排序</a></div>' +
        bookGrid(hot) +
      '</section>' +

      '<section class="feature-strip reveal">' +
        feature('🚚', '极速发货', '48 小时内出库') +
        feature('🛡', '正品保障', '出版社直供') +
        feature('↩', '七天退换', '未拆封可退') +
        feature('🔒', '安全支付', '货到付款 / 在线支付') +
      '</section>';
  }

  /* ================= 图书列表 ================= */
  function viewBooks(q) {
    var kw = (q.get('q') || '').trim();
    var cat = q.get('cat') || '';
    var sort = q.get('sort') || 'default';
    var list = BOOKS.filter(function (b) {
      if (!onSale(b)) return false;
      if (cat && b.cat !== cat) return false;
      if (kw && (b.title + b.author + b.publisher + b.tags.join('')).indexOf(kw) < 0) return false;
      return true;
    });
    if (sort === 'price-asc') list.sort(function (a, b) { return a.price - b.price; });
    if (sort === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });

    function chipHref(c) {
      var p = [];
      if (kw) p.push('q=' + encodeURIComponent(kw));
      if (c) p.push('cat=' + c);
      return '#/books' + (p.length ? '?' + p.join('&') : '');
    }
    var chips = '<a class="chip' + (!cat ? ' active' : '') + '" href="' + chipHref('') + '">全部</a>' +
      CATS.map(function (c) {
        return '<a class="chip' + (cat === c.id ? ' active' : '') + '" href="' + chipHref(c.id) + '">' + esc(c.name) + '</a>';
      }).join('');

    return pageHead('全部图书', '共 ' + list.length + ' 本') +
      '<div class="toolbar">' +
        '<form class="search-box" id="search-form">' +
          '<input type="search" name="q" placeholder="搜书名、作者、出版社" value="' + esc(kw) + '">' +
          '<button class="btn btn-primary" type="submit">搜索</button>' +
        '</form>' +
        '<select class="select" id="sort-select">' +
          '<option value="default"' + (sort === 'default' ? ' selected' : '') + '>默认排序</option>' +
          '<option value="price-asc"' + (sort === 'price-asc' ? ' selected' : '') + '>价格从低到高</option>' +
          '<option value="price-desc"' + (sort === 'price-desc' ? ' selected' : '') + '>价格从高到低</option>' +
        '</select>' +
      '</div>' +
      '<div class="chip-row">' + chips + '</div>' +
      (kw ? '<p class="result-line"><span>关键词「' + esc(kw) + '」</span><span>' + list.length + ' 条结果</span></p>' : '') +
      bookGrid(list);
  }

  /* ================= 详情 ================= */
  function viewBook(id) {
    var b = bookById(id);
    if (!b) return '<div class="empty"><div class="empty-ico">📕</div><h3>没有这本书</h3><p><a href="#/books">回图书列表</a></p></div>';
    var left = stockOf(b);
    var canBuy = left > 0 && onSale(b);
    return '<div class="crumb"><a href="#/">首页</a> / <a href="#/books">全部图书</a> / ' + esc(b.title) + '</div>' +
      '<div class="detail">' +
        '<div class="detail-cover" style="background:' + b.cover + '">' +
          '<span class="dc-cat">' + esc(catName(b.cat)) + '</span>' +
          '<div><div class="dc-title">' + esc(b.title) + '</div><div class="dc-author">' + esc(b.author) + '</div></div>' +
        '</div>' +
        '<div class="detail-info">' +
          '<span class="badge-cat">' + esc(catName(b.cat)) + '</span>' +
          '<h1>' + esc(b.title) + '</h1>' +
          '<div class="detail-meta">' + esc(b.author) + '　·　' + esc(b.publisher) + '</div>' +
          '<div class="detail-price-row">' +
            '<span class="price">' + money(b.price) + '</span>' +
            '<span class="price-old">' + money(b.original) + '</span>' +
            '<span class="stock">' + (left > 0 ? '库存 ' + left + ' 本' : '暂时缺货') + '</span>' +
          '</div>' +
          '<div class="buy-row">' +
            '<div class="qty">' +
              '<button type="button" data-action="qty-minus">−</button>' +
              '<input type="text" id="qty-input" value="1" inputmode="numeric">' +
              '<button type="button" data-action="qty-plus">+</button>' +
            '</div>' +
            '<button class="btn btn-primary" data-action="add-cart" data-id="' + b.id + '"' + (canBuy ? '' : ' disabled') + '>加入购物车</button>' +
            '<button class="btn btn-ghost" data-action="buy-now" data-id="' + b.id + '"' + (canBuy ? '' : ' disabled') + '>立即购买</button>' +
          '</div>' +
          '<div class="detail-cards">' +
            '<div class="info-card"><h3>内容简介</h3><p>' + esc(b.intro) + '</p></div>' +
            '<div class="info-card"><h3>图书信息</h3><div class="info-grid">' +
              '<div><div class="k">作者</div><div class="v">' + esc(b.author) + '</div></div>' +
              '<div><div class="k">出版社</div><div class="v">' + esc(b.publisher) + '</div></div>' +
              '<div><div class="k">分类</div><div class="v">' + esc(catName(b.cat)) + '，' + esc(b.tags.join(' / ')) + '</div></div>' +
              '<div><div class="k">定价</div><div class="v">' + money(b.original) + '（现价 ' + money(b.price) + '）</div></div>' +
            '</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ================= 购物车 ================= */
  function viewCart() {
    var lines = cartLines();
    if (!lines.length) return pageHead('购物车') + '<div class="empty"><div class="empty-ico">🛒</div><h3>购物车还是空的</h3><p>去挑几本书吧。</p><a class="btn btn-primary" href="#/books" style="margin-top:14px">去选书</a></div>';
    var total = cartTotal(), fee = shipFee(total);
    return pageHead('购物车', '共 ' + cartCount() + ' 件') +
      '<div class="cart-layout">' +
        '<div class="cart-list">' + lines.map(function (l) {
          var b = l.book;
          return '<div class="cart-row">' +
            '<a href="#/book/' + b.id + '" class="cart-thumb" style="background:' + b.cover + '">' + esc(b.title) + '</a>' +
            '<div><div class="cart-name"><a href="#/book/' + b.id + '">' + esc(b.title) + '</a></div><div class="cart-author">' + esc(b.author) + '</div></div>' +
            '<div class="cart-qty-cell"><div class="qty" style="height:38px">' +
              '<button type="button" data-action="cart-minus" data-id="' + b.id + '">−</button>' +
              '<input type="text" value="' + l.qty + '" readonly>' +
              '<button type="button" data-action="cart-plus" data-id="' + b.id + '">+</button>' +
            '</div></div>' +
            '<div class="cart-sum">' + money(l.sum) + '</div>' +
            '<div class="cart-del-cell"><button class="cart-del" data-action="remove-line" data-id="' + b.id + '">删除</button></div>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="summary"><h3>结算信息</h3>' +
          '<div class="sum-row"><span>商品件数</span><b>' + cartCount() + ' 件</b></div>' +
          '<div class="sum-row"><span>商品金额</span><b>' + money(total) + '</b></div>' +
          '<div class="sum-row"><span>运费</span><b>' + (fee ? money(fee) : '免运费') + '</b></div>' +
          '<div class="sum-total"><span>合计</span><span class="price">' + money(total + fee) + '</span></div>' +
          '<button class="btn btn-primary btn-block" data-action="go-checkout">去结算</button>' +
          '<p class="note">满 59 元包邮</p>' +
        '</div>' +
      '</div>';
  }

  /* ================= 结算 ================= */
  function viewCheckout() {
    var lines = cartLines();
    if (!lines.length) return '<div class="empty"><div class="empty-ico">🛒</div><h3>购物车是空的，无法结算</h3><a class="btn btn-primary" href="#/books" style="margin-top:14px">去选书</a></div>';
    var total = cartTotal(), fee = shipFee(total);
    return pageHead('确认订单', '核对信息后提交') +
      '<div class="cart-layout">' +
        '<div class="info-card">' +
          '<div class="form-tip"><span>💵</span><div>Demo 不接在线支付。提交后订单进入「待付款」，可在订单页模拟付款推进流程。</div></div>' +
          '<form id="checkout-form" novalidate>' +
            '<div class="field" data-field="receiver"><label>收货人<span class="req">*</span></label><input name="receiver" placeholder="请输入收货人姓名" value="' + esc(state.session ? state.session.nickname : '') + '"><div class="err">请填写收货人姓名（至少 2 个字）</div></div>' +
            '<div class="field" data-field="phone"><label>手机号<span class="req">*</span></label><input name="phone" placeholder="11 位手机号" inputmode="numeric" maxlength="11"><div class="err">请输入正确的 11 位手机号</div></div>' +
            '<div class="field" data-field="address"><label>收货地址<span class="req">*</span></label><textarea name="address" placeholder="省 / 市 / 区 + 详细地址"></textarea><div class="err">地址至少填写 6 个字</div></div>' +
            '<div class="field" data-field="remark"><label>订单备注（选填）</label><input name="remark" placeholder="例如：工作日送货"></div>' +
            '<button class="btn btn-primary btn-block" type="submit">提交订单</button>' +
          '</form>' +
        '</div>' +
        '<div class="summary"><h3>订单明细</h3>' +
          lines.map(function (l) { return '<div class="sum-row"><span>' + esc(l.book.title) + ' × ' + l.qty + '</span><b>' + money(l.sum) + '</b></div>'; }).join('') +
          '<div class="sum-total"><span>应付</span><span class="price">' + money(total + fee) + '</span></div>' +
          '<p class="note">提交后可在「我的订单」查看进度</p>' +
        '</div>' +
      '</div>';
  }

  /* ================= 订单 ================= */
  function viewOrders() {
    if (!state.orders.length) return pageHead('我的订单') + '<div class="empty"><div class="empty-ico">📦</div><h3>还没有订单</h3><p>下单后会出现在这里。</p><a class="btn btn-primary" href="#/books" style="margin-top:14px">去选书</a></div>';
    return pageHead('我的订单', '共 ' + state.orders.length + ' 单') +
      state.orders.map(function (o) {
        var ops = '';
        if (o.status === 'pending') {
          ops += '<button class="btn btn-sm btn-primary" data-action="pay" data-id="' + o.id + '">模拟付款</button>';
          ops += '<button class="btn btn-sm btn-ghost" data-action="cancel-order" data-id="' + o.id + '">取消订单</button>';
        }
        if (o.status === 'shipped') ops += '<button class="btn btn-sm btn-navy" data-action="confirm-receive" data-id="' + o.id + '">确认收货</button>';
        return '<div class="order-card">' +
          '<div class="order-head"><span class="no">' + o.no + '</span><span>' + fmtTime(o.createdAt) + '</span><span class="spacer"></span>' + pill(o.status) + '</div>' +
          '<div class="order-body">' + o.items.map(function (it) {
            return '<div class="order-line"><div class="thumb" style="background:' + it.cover + '"></div><div class="nm">' + esc(it.title) + ' <small>× ' + it.qty + '</small></div><div class="price">' + money(it.price * it.qty) + '</div></div>';
          }).join('') + '</div>' +
          '<div class="order-foot"><div class="total">合计<b>' + money(o.total) + '</b></div><div class="order-actions"><a class="btn btn-sm btn-ghost" href="#/order/' + o.id + '">订单详情</a>' + ops + '</div></div>' +
        '</div>';
      }).join('');
  }

  function viewOrder(id) {
    var o = state.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return '<div class="empty"><div class="empty-ico">📦</div><h3>订单不存在</h3><a href="#/orders">回我的订单</a></div>';
    var steps = ['pending', 'paid', 'shipped', 'done'];
    var idx = o.status === 'cancelled' ? -1 : steps.indexOf(o.status);
    var timeline = steps.map(function (s, i) {
      return '<div class="tl-step' + (i <= idx ? ' done' : '') + '"><span class="dot"></span>' + STATUS[s] + '</div>' +
        (i < steps.length - 1 ? '<div class="tl-line' + (i < idx ? ' done' : '') + '"></div>' : '');
    }).join('');
    var actions = '';
    if (o.status === 'pending') actions = '<button class="btn btn-primary" data-action="pay" data-id="' + o.id + '">模拟付款</button>';
    if (o.status === 'shipped') actions = '<button class="btn btn-navy" data-action="confirm-receive" data-id="' + o.id + '">确认收货</button>';
    return pageHead('订单详情', o.no) +
      '<div class="detail-card"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' + pill(o.status) +
        '<span class="muted" style="font-size:13px">下单时间 ' + fmtTime(o.createdAt) + '</span></div>' +
        (o.status === 'cancelled' ? '<div class="form-tip" style="margin-top:16px"><span>✕</span><div>该订单已取消，库存已回补。</div></div>' : '<div class="timeline">' + timeline + '</div>') +
        (actions ? '<div style="margin-top:18px">' + actions + '</div>' : '') +
      '</div>' +
      '<div class="detail-card"><h3>商品</h3>' + o.items.map(function (it) {
        return '<div class="order-line"><div class="thumb" style="background:' + it.cover + ';width:56px"></div><div class="nm">' + esc(it.title) + ' <small>' + money(it.price) + ' × ' + it.qty + '</small></div><div class="price">' + money(it.price * it.qty) + '</div></div>';
      }).join('') +
      '<div class="sum-total" style="margin-top:12px"><span>商品合计</span><span class="price">' + money(o.total) + '</span></div></div>' +
      '<div class="detail-card"><h3>收货信息</h3><div class="addr-grid">' +
        '<div><div class="k">收货人</div><div class="v">' + esc(o.receiver) + '</div></div>' +
        '<div><div class="k">手机号</div><div class="v">' + esc(o.phone) + '</div></div>' +
        '<div style="grid-column:1/-1"><div class="k">收货地址</div><div class="v">' + esc(o.address) + '</div></div>' +
        (o.remark ? '<div style="grid-column:1/-1"><div class="k">备注</div><div class="v">' + esc(o.remark) + '</div></div>' : '') +
      '</div></div>' +
      '<div class="detail-card"><h3>支付方式</h3><p class="muted" style="margin:0">货到付款（Demo 模拟，无真实支付）</p></div>';
  }

  /* ================= 登录 / 注册 ================= */
  function viewLogin(q) {
    var next = q.get('next') || '/';
    var adminMode = q.get('admin') === '1';
    var reg = '#/register' + (next !== '/' ? '?next=' + encodeURIComponent(next) : '');
    return '<div class="auth-wrap"><div class="auth-card">' +
      '<h1>欢迎回来</h1>' +
      '<p class="sub">登录后可以下单、查看订单</p>' +
      '<div class="admin-note' + (adminMode ? ' show' : '') + '">后台入口仅对管理员开放，请使用管理员账号登录。</div>' +
      '<form id="login-form" data-next="' + esc(next) + '" novalidate>' +
        '<div class="field" data-field="email"><label>邮箱<span class="req">*</span></label><input name="email" type="email" placeholder="you@example.com" autocomplete="username"><div class="err">请输入正确的邮箱地址</div></div>' +
        '<div class="field" data-field="password"><label>密码<span class="req">*</span></label><input name="password" type="password" placeholder="至少 6 位" autocomplete="current-password"><div class="err">密码至少 6 位</div></div>' +
        '<div class="auth-actions"><span>还没有账号？</span><a href="' + reg + '">去注册</a></div>' +
        '<button class="btn btn-primary btn-block" type="submit">登录</button>' +
      '</form>' +
      '<p class="auth-switch">还没有账号？<a href="' + reg + '">立即注册</a></p>' +
      '<div class="auth-hint"><b>演示账号</b><br>顾客：先注册一个邮箱账号即可登录<br>管理员：<b>admin@moyu.com</b> / <b>admin123</b>（登录后自动进入后台）</div>' +
    '</div></div>';
  }

  function viewRegister(q) {
    var next = q.get('next') || '/';
    var back = '#/login' + (next !== '/' ? '?next=' + encodeURIComponent(next) : '');
    return '<div class="auth-wrap"><div class="auth-card">' +
      '<h1>创建账号</h1>' +
      '<p class="sub">用邮箱注册，注册后自动登录</p>' +
      '<form id="register-form" data-next="' + esc(next) + '" novalidate>' +
        '<div class="field" data-field="email"><label>邮箱<span class="req">*</span></label><input name="email" type="email" placeholder="you@example.com" autocomplete="username"><div class="err">请输入正确的邮箱地址</div></div>' +
        '<div class="field" data-field="nickname"><label>昵称<span class="req">*</span></label><input name="nickname" placeholder="怎么称呼你"><div class="err">昵称至少 2 个字</div></div>' +
        '<div class="field" data-field="password"><label>密码<span class="req">*</span></label><input name="password" type="password" placeholder="至少 6 位" autocomplete="new-password"><div class="err">密码至少 6 位</div></div>' +
        '<div class="field" data-field="confirm"><label>确认密码<span class="req">*</span></label><input name="confirm" type="password" placeholder="再输入一次" autocomplete="new-password"><div class="err">两次输入的密码不一致</div></div>' +
        '<button class="btn btn-primary btn-block" type="submit">注册并登录</button>' +
      '</form>' +
      '<p class="auth-switch">已经有账号了？<a href="' + back + '">去登录</a></p>' +
    '</div></div>';
  }

  /* ================= 后台 ================= */
  function viewAdmin() {
    var orders = state.orders;
    var waitShip = orders.filter(function (o) { return o.status === 'paid'; }).length;
    var stats = [
      { k: '图书总数', v: BOOKS.length },
      { k: '在售图书', v: BOOKS.filter(onSale).length },
      { k: '订单总数', v: orders.length },
      { k: '待发货', v: waitShip, accent: true }
    ];
    var head = '<div class="admin-shell"><div class="admin-head">' +
      '<div><h1>后台管理</h1><div class="who">当前管理员：' + esc(state.session.nickname) + '（' + esc(state.session.email) + '）</div></div>' +
      '<div style="display:flex;gap:10px"><a class="btn btn-ghost btn-sm" href="#/">返回前台</a><button class="btn btn-sm btn-navy" data-action="logout">退出登录</button></div>' +
      '</div>' +
      '<div class="stat-grid">' + stats.map(function (s) {
        return '<div class="stat-card' + (s.accent ? ' accent' : '') + '"><div class="k">' + s.k + '</div><div class="v">' + s.v + '</div></div>';
      }).join('') + '</div>' +
      '<div class="admin-tabs">' +
        '<button data-action="admin-tab" data-tab="orders" class="' + (state.adminTab === 'orders' ? 'active' : '') + '">订单管理</button>' +
        '<button data-action="admin-tab" data-tab="books" class="' + (state.adminTab === 'books' ? 'active' : '') + '">图书管理</button>' +
      '</div>';

    if (state.adminTab === 'books') {
      var rows = BOOKS.map(function (b) {
        var on = onSale(b);
        return '<tr><td>' + b.id + '</td><td>' + esc(b.title) + '</td><td>' + esc(catName(b.cat)) + '</td><td>' + money(b.price) + '</td><td>' + stockOf(b) + '</td>' +
          '<td>' + (on ? '<span class="pill pill-done">在售</span>' : '<span class="pill pill-cancelled">已下架</span>') + '</td>' +
          '<td><div class="actions"><button class="btn btn-sm btn-ghost" data-action="toggle-book" data-id="' + b.id + '">' + (on ? '下架' : '上架') + '</button></div></td></tr>';
      }).join('');
      return head + '<div class="table-wrap"><table><thead><tr><th>ID</th><th>书名</th><th>分类</th><th>价格</th><th>库存</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    if (!orders.length) {
      return head + '<div class="empty"><div class="empty-ico">🧾</div><h3>暂无订单</h3><p>前台下单后会出现在这里。</p></div></div>';
    }
    var orows = orders.map(function (o) {
      var ops = '<a class="btn btn-sm btn-ghost" href="#/order/' + o.id + '">查看</a>';
      if (o.status === 'paid') ops += '<button class="btn btn-sm btn-primary" data-action="ship" data-id="' + o.id + '">发货</button>';
      if (o.status === 'shipped') ops += '<button class="btn btn-sm btn-navy" data-action="complete" data-id="' + o.id + '">设为完成</button>';
      return '<tr><td style="font-family:ui-monospace,Consolas,monospace">' + o.no + '</td><td>' + esc(o.receiver) + '</td><td>' + money(o.total) + '</td><td>' + pill(o.status) + '</td><td>' + fmtTime(o.createdAt) + '</td><td><div class="actions">' + ops + '</div></td></tr>';
    }).join('');
    return head + '<div class="table-wrap"><table><thead><tr><th>订单号</th><th>收货人</th><th>金额</th><th>状态</th><th>下单时间</th><th>操作</th></tr></thead><tbody>' + orows + '</tbody></table></div></div>';
  }

  /* ================= 订单操作 ================= */
  function findOrder(id) { return state.orders.filter(function (o) { return o.id === id; })[0]; }

  function createOrder(data) {
    var lines = cartLines(), total = cartTotal();
    var o = {
      id: 'o' + Date.now(),
      no: 'BS' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.floor(Math.random() * 9000 + 1000),
      items: lines.map(function (l) { return { id: l.book.id, title: l.book.title, price: l.book.price, qty: l.qty, cover: l.book.cover }; }),
      total: total, receiver: data.receiver, phone: data.phone, address: data.address, remark: data.remark || '',
      status: 'pending', createdAt: Date.now()
    };
    lines.forEach(function (l) { state.stock[l.book.id] = Math.max(0, stockOf(l.book) - l.qty); });
    state.orders.unshift(o);
    state.cart = [];
    saveAll();
    return o;
  }

  /* ================= 渲染 ================= */
  function render() {
    var r = route(), html = '', m;

    if (r.path === '/' || r.path === '') html = viewHome();
    else if (r.path === '/books') html = viewBooks(r.query);
    else if ((m = r.path.match(/^\/book\/(\d+)$/))) html = viewBook(m[1]);
    else if (r.path === '/cart') html = viewCart();
    else if (r.path === '/checkout') {
      if (!state.session) { replace('/login?next=' + encodeURIComponent('/checkout')); toast('请先登录'); return; }
      html = viewCheckout();
    }
    else if (r.path === '/orders') {
      if (!state.session) { replace('/login?next=' + encodeURIComponent('/orders')); toast('请先登录'); return; }
      html = viewOrders();
    }
    else if ((m = r.path.match(/^\/order\/(.+)$/))) html = viewOrder(m[1]);
    else if (r.path === '/login') html = viewLogin(r.query);
    else if (r.path === '/register') html = viewRegister(r.query);
    else if (r.path === '/admin') {
      if (!state.session) { replace('/login?admin=1&next=' + encodeURIComponent('/admin')); toast('请先登录管理员账号'); return; }
      if (!isAdmin()) { replace('/'); toast('当前账号没有后台权限'); return; }
      html = viewAdmin();
    }
    else html = '<div class="empty"><div class="empty-ico">🧭</div><h3>页面不存在</h3><a href="#/">回首页</a></div>';

    var $app = $('#app');
    $app.html('<div class="wrap">' + html + '</div>').removeClass('page-enter');
    void $app[0].offsetWidth;
    $app.addClass('page-enter');

    setActiveNav(r.path);
    syncChrome();
    revealCards();
    if (r.path === '/login' || r.path === '/register') $('#app input[name=email]').trigger('focus');
  }

  function setActiveNav(path) {
    var target = path === '/' ? '/' : path.indexOf('/books') === 0 || path.indexOf('/book/') === 0 ? '/books'
      : path.indexOf('/orders') === 0 || path.indexOf('/order/') === 0 ? '/orders' : '';
    $('.main-nav a[data-nav]').each(function () {
      $(this).toggleClass('active', $(this).attr('data-nav') === target);
    });
  }

  /* ================= 事件 ================= */
  $(document).on('click', '[data-action]', function (e) {
    var $el = $(this), action = $el.attr('data-action'), id = $el.attr('data-id');

    if (action === 'logout') { e.preventDefault(); logout(); return; }
    if (action === 'reset-demo') {
      ['bs_users', 'bs_session', 'bs_cart', 'bs_orders', 'bs_stock', 'bs_book_status'].forEach(function (k) { localStorage.removeItem(k); });
      location.hash = '#/'; location.reload(); return;
    }
    if (action === 'qty-minus' || action === 'qty-plus') {
      var $in = $('#qty-input');
      if (!$in.length) return;
      var v = parseInt($in.val(), 10) || 1;
      v = action === 'qty-plus' ? v + 1 : v - 1;
      var cur = bookById(route().path.split('/').pop());
      var limit = cur ? Math.max(1, stockOf(cur)) : 99;
      if (v > limit) { v = limit; toast('库存只够 ' + limit + ' 本'); }
      $in.val(Math.max(1, v));
      return;
    }
    if (action === 'add-cart') { addToCart(id, parseInt($('#qty-input').val(), 10) || 1); return; }
    if (action === 'buy-now') {
      addToCart(id, parseInt($('#qty-input').val(), 10) || 1);
      if (!state.session) { go('/login?next=' + encodeURIComponent('/checkout')); toast('请先登录'); return; }
      go('/checkout'); return;
    }
    if (action === 'cart-plus' || action === 'cart-minus') {
      var line = state.cart.filter(function (l) { return l.id === Number(id); })[0];
      if (line) setQty(id, action === 'cart-plus' ? line.qty + 1 : line.qty - 1);
      return;
    }
    if (action === 'remove-line') { removeLine(id); toast('已从购物车移除'); return; }
    if (action === 'go-checkout') {
      if (!state.session) { go('/login?next=' + encodeURIComponent('/checkout')); toast('请先登录'); return; }
      go('/checkout'); return;
    }
    if (action === 'pay') {
      var o = findOrder(id);
      if (o && o.status === 'pending') { o.status = 'paid'; saveAll(); toast('付款成功，等待发货'); render(); }
      return;
    }
    if (action === 'cancel-order') {
      var oc = findOrder(id);
      if (oc && (oc.status === 'pending' || oc.status === 'paid')) {
        oc.status = 'cancelled';
        oc.items.forEach(function (it) { var b = bookById(it.id); if (b) state.stock[b.id] = stockOf(b) + it.qty; });
        saveAll(); toast('订单已取消，库存已回补'); render();
      }
      return;
    }
    if (action === 'confirm-receive') {
      var or = findOrder(id);
      if (or && or.status === 'shipped') { or.status = 'done'; saveAll(); toast('已确认收货'); render(); }
      return;
    }
    if (action === 'ship' || action === 'complete') {
      var os = findOrder(id);
      if (!os) return;
      if (action === 'ship' && os.status === 'paid') { os.status = 'shipped'; saveAll(); toast('已发货'); render(); }
      if (action === 'complete' && os.status === 'shipped') { os.status = 'done'; saveAll(); toast('订单已完成'); render(); }
      return;
    }
    if (action === 'admin-tab') { state.adminTab = $el.attr('data-tab'); render(); return; }
    if (action === 'toggle-book') {
      var bid = Number(id);
      state.bookStatus[bid] = onSale(bookById(bid)) ? 'off' : 'on';
      saveAll(); toast('已更新上架状态'); render(); return;
    }
  });

  $(document).on('submit', '#search-form', function (e) {
    e.preventDefault();
    var kw = ($(this).find('input[name=q]').val() || '').trim();
    var cat = route().query.get('cat') || '';
    var p = [];
    if (kw) p.push('q=' + encodeURIComponent(kw));
    if (cat) p.push('cat=' + cat);
    go('/books' + (p.length ? '?' + p.join('&') : ''));
  });

  $(document).on('change', '#sort-select', function () {
    var p = new URLSearchParams(route().query.toString());
    p.set('sort', $(this).val());
    go('/books?' + p.toString());
  });

  $(document).on('input', '#qty-input', function () {
    this.value = this.value.replace(/[^\d]/g, '').slice(0, 2);
  });

  function setFieldError($form, name, bad) {
    $form.find('[data-field="' + name + '"]').toggleClass('has-error', !!bad);
  }

  $(document).on('submit', '#login-form', function (e) {
    e.preventDefault();
    var $f = $(this);
    var email = ($f.find('input[name=email]').val() || '').trim();
    var pass = $f.find('input[name=password]').val() || '';
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    var okPass = pass.length >= 6;
    setFieldError($f, 'email', !okEmail);
    setFieldError($f, 'password', !okPass);
    if (!okEmail || !okPass) { toast('请检查邮箱和密码'); return; }

    var user = findUser(email);
    if (!user) { setFieldError($f, 'email', true); toast('该邮箱还没有注册'); return; }
    if (user.password !== pass) { setFieldError($f, 'password', true); toast('密码不正确'); return; }

    var session = login(email, pass);
    syncChrome();
    if (session.role === 'admin') { toast('管理员登录成功，正在进入后台'); go('/admin'); return; }
    toast('登录成功，欢迎回来');
    var next = $f.attr('data-next') || '/';
    if (next.indexOf('/admin') === 0) next = '/';
    go(next);
  });

  $(document).on('submit', '#register-form', function (e) {
    e.preventDefault();
    var $f = $(this);
    var email = ($f.find('input[name=email]').val() || '').trim().toLowerCase();
    var nickname = ($f.find('input[name=nickname]').val() || '').trim();
    var pass = $f.find('input[name=password]').val() || '';
    var confirm = $f.find('input[name=confirm]').val() || '';
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    var okNick = nickname.length >= 2;
    var okPass = pass.length >= 6;
    var okConfirm = pass === confirm && pass.length > 0;

    setFieldError($f, 'email', !okEmail || !!findUser(email));
    setFieldError($f, 'nickname', !okNick);
    setFieldError($f, 'password', !okPass);
    setFieldError($f, 'confirm', !okConfirm);
    if (!okEmail) { toast('请输入正确的邮箱'); return; }
    if (findUser(email)) { toast('该邮箱已注册，请直接登录'); return; }
    if (!okNick || !okPass || !okConfirm) { toast('请检查表单填写'); return; }

    register(email, nickname, pass);
    syncChrome();
    toast('注册成功，已自动登录');
    var next = $f.attr('data-next') || '/';
    go(next === '/admin' ? '/' : next);
  });

  $(document).on('submit', '#checkout-form', function (e) {
    e.preventDefault();
    var $f = $(this);
    var receiver = ($f.find('input[name=receiver]').val() || '').trim();
    var phone = ($f.find('input[name=phone]').val() || '').trim();
    var address = ($f.find('textarea[name=address]').val() || '').trim();
    var remark = ($f.find('input[name=remark]').val() || '').trim();
    var okR = receiver.length >= 2, okP = /^1[3-9]\d{9}$/.test(phone), okA = address.length >= 6;
    setFieldError($f, 'receiver', !okR);
    setFieldError($f, 'phone', !okP);
    setFieldError($f, 'address', !okA);
    if (!okR || !okP || !okA) { toast('请检查收货信息'); return; }
    if (!cartLines().length) { toast('购物车是空的'); go('/cart'); return; }
    var o = createOrder({ receiver: receiver, phone: phone, address: address, remark: remark });
    syncChrome();
    toast('下单成功，订单号 ' + o.no);
    go('/order/' + o.id);
  });

  $(document).on('click', '#search-jump', function (e) {
    e.preventDefault();
    if (route().path === '/books') { $('#search-form input[name=q]').trigger('focus'); return; }
    go('/books'); setTimeout(function () { $('#search-form input[name=q]').trigger('focus'); }, 300);
  });

  $(window).on('scroll', function () {
    $('#site-header').toggleClass('scrolled', $(window).scrollTop() > 12);
  });

  $(window).on('hashchange', render);
  $(document).ready(function () {
    syncChrome();
    render();
    $('#site-header').toggleClass('scrolled', $(window).scrollTop() > 12);
  });
})(jQuery);
