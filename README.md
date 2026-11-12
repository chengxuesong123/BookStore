# 墨屿书屋 · 图书商城 v2（前后端分离）

第二版：前端 Vue 3 SPA，后端 ThinkPHP 8 纯 API，两者独立目录、独立启动。
第一版（TP8 服务端渲染）保留在 Git tag `v1.0-mvp`，设计文档见 `docs/产品设计.md`；本版设计见 `docs/产品设计-v2.md`。

## 目录

```
bookstor/     前端（Vue 3 + Vite + Pinia + Vue Router + axios）
server/       后端（ThinkPHP 8，纯 API，无视图）
docs/         产品设计文档
tests/        api.mjs（接口契约）+ e2e-v2.mjs（浏览器端到端）
demo/         v1 的纯前端原型，只作视觉参考
```

## 环境

- PHP 8.1+（pdo_mysql、mbstring、openssl）
- MySQL 5.7+
- Node 20+、pnpm
- 测试可选：Microsoft Edge（CDP）

## 安装

```powershell
# 后端
cd server
composer install
copy .example.env .env        # 编辑 DB_* 配置
php think db:init --seed --force

# 前端
cd ..\bookstor
pnpm install
```

## 启动（两个终端）

```powershell
# 终端 1：API（8124）
cd server
php -S 127.0.0.1:8124 -t public public/router.php

# 终端 2：前端（5173，/api 与 /uploads 代理到 8124）
cd bookstor
pnpm dev
```

打开 http://127.0.0.1:5173

生产构建：`pnpm build` 产出 `bookstor/dist`，Nginx 托管并 history fallback 到 `index.html`，`/api` 反代到 PHP。

## 演示账号

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | admin@moyu.com | admin123 |
| 顾客 | 自行注册 | 至少 6 位 |

## v2 改了什么

- **前后端分离**：`bookstor/`（Vue 3 SPA）+ `server/`（TP8 API），接口统一 `{code,msg,data}`
- **导航图标**：搜索/购物车换成 24px 线性 SVG，40×40 命中区，与 36px 头像垂直对齐
- **购物车红点**：空车完全不渲染，有商品才出现红点（带件数，99+）
- **头像与用户中心**：顶栏用户按钮改为头像，点击进 `/account`，可上传头像（jpg/png/webp ≤2MB）、改昵称
- **立即购买**：详情页直达 `/checkout?mode=direct`，只结算当前这本，不写、不清购物车
- **后台不迷路**：固定侧边栏 + 面包屑 + 后台内 404，刷新/直链可用；管理员在前台有「后台」入口，普通用户看不到
- **CSRF**：API 写请求带 `X-CSRF-Token` 头，缺失返回 419
- **库表**：`users.avatar`、`orders.source`（cart/direct）

## 接口概览

`GET /api/health`、`/api/auth/*`、`/api/books`、`/api/cart`、`/api/checkout/{cart,direct}`、`/api/orders/*`、`/api/user/{profile,avatar}`、`/api/admin/*`。详见 `docs/产品设计-v2.md` 第 5 节。

## 测试

```powershell
# 接口契约（先启动后端 8124）
node tests/api.mjs --reset

# 浏览器端到端（先后端、前端、Edge 都起来）
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir=D:\wamp\php\BookStore\tests\.edge-profile
node tests/e2e-v2.mjs --reset
```

当前覆盖：接口 28 项（鉴权/403/419/图书/购物车/立即购买不串车/扣库存/取消回补/越权/头像 MIME/分类）；E2E 43 项（图标与对齐、红点显隐、注册与头像入口、昵称、加购、立即购买、后台侧边栏与刷新、权限、退出）。

## 与设计文档的差异

- 前端实现使用 **JavaScript**（未启用 TypeScript），其余按 `docs/产品设计-v2.md` 执行。
- 头像更换后旧文件即删，存储在本机 `server/public/uploads/avatars/`，没有接对象存储。

## 已知限制

- 支付为模拟，没有接支付渠道
- 封面仍是 CSS 渐变字符串，没有图片上传（头像除外）
- 运费规则写死：满 59 免运费，否则 6 元
- 测试依赖本机路径常量（PHP、Edge），换机器要改 `tests/*.mjs` 顶部
