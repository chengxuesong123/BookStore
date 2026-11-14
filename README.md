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

## v5 改了什么（本版）

- **书库换 500 本真实书目**：`server/database/books-real.csv`（书名/作者/分类真实），`php think books:import --truncate` 导入；`db:init --seed` 会自动导
- **每页/每栏 10 本**：列表与首页统一 10 本，后端 `page_size` 默认 10
- **5 页码窗口**：分页只显示当前页附近 5 个页码 + 上一页/下一页，不再平铺 50/125 个页码
- **本地 SVG 书封**：`GET /api/cover/{id}` 按分类配色 + 书名/作者/出版社生成，不依赖外网；有外链封面时优先用外链
- **封面回填**：`php think cover:backfill --limit=200`，外网可用时把本地占位替换成 Open Library / Google Books 真封面
- **头像加固**：前端 canvas 压缩到 512px 再传（5MB 照片也能传），服务端上限放宽到 5MB，上传后用户中心与导航栏同步刷新

## v4 改了什么（历史）

- **书库扩到 1000 本**：6 个分类各 166–167 本，种子由 `server/database/generate_seed.php` 生成
- **封面自动获取**：新增/改名时按书名先查 Open Library，找不到再查 Google Books；都失败就留空，前台用稳定渐变占位
- **后台不再手填封面**：图书表单删掉封面输入框，改为只读预览 + 说明；新增 `php think cover:backfill` 批量补封面
- **前台封面统一渲染**：图片地址、CSS 渐变、空封面三种情况都由 `coverStyle()` 处理，任何书都有封面可看
- **头像上传修复**：去掉手写的 multipart Content-Type（boundary 丢失导致上传失败），用户中心与导航栏同步立即显示
- **后台用户管理**：`/admin/users` 可搜索、查看用户信息与订单数、改昵称/角色、重置密码；不能改自己角色、至少保留一个管理员

## v3 改了什么（历史）

- **修好首页不显示图书**：书卡补回 .in 入场类（样式里 opacity:0 靠它打开），Hero 书堆类名改回 .book-float，分类卡改用 .mini-book
- **加载/失败状态**：接口挂了或没数据时显示可读提示 + 「重新加载」，不再白屏
- **头像放大**：导航头像 36px → 40px（移动端 36、后台顶栏 34）
- **搜索自动收起**：点搜索框和图标以外的任意位置、切换页面、提交搜索都会关闭浮层
- **Demo 模式**：VITE_MOCK=1 时前端用浏览器内 mock 数据，后端完全不用启动

## 接口概览

`GET /api/health`、`/api/auth/*`、`/api/books`、`/api/cart`、`/api/checkout/{cart,direct}`、`/api/orders/*`、`/api/user/{profile,avatar}`、`/api/admin/{stats,books,orders,users,categories}`。详见 `docs/产品改进书-v5.md`。

## 测试

```powershell
# 接口契约（先启动后端 8124）
node tests/api.mjs --reset

# 浏览器端到端（先后端、前端、Edge 都起来）
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir=D:\wamp\php\BookStore\tests\.edge-profile
node tests/e2e.mjs --reset
```

当前覆盖：接口 40 项（鉴权/403/419/500 本且每类≥10/默认每页 10/本地 SVG 书封/图书/购物车/立即购买不串车/扣库存/取消回补/越权/头像 MIME/分类/用户管理/封面解析单测）；E2E 66 项（500 总数、每页 10、5 页码窗口、书卡与封面、头像上传显示、搜索收起、立即购买、后台用户管理/无手填封面、权限、退出）。Demo 冒烟 12 项（`node tests/demo-check.mjs`）。

## Demo（不需要后端）

`powershell
cd bookstor
pnpm dev:mock          # http://127.0.0.1:5174
# 或先构建再预览
pnpm build:mock && pnpm preview:mock   # http://127.0.0.1:4174
`

mock 数据存在 localStorage（键 moyu-mock-v3），管理员仍是 dmin@moyu.com / admin123；清空演示数据就在控制台删掉这个键再刷新。

## 与设计文档的差异

- 前端实现使用 **JavaScript**（未启用 TypeScript），其余按 `docs/产品设计-v2.md` 执行。
- 头像更换后旧文件即删，存储在本机 `server/public/uploads/avatars/`，没有接对象存储。

## 已知限制

- 支付为模拟，没有接支付渠道
- 封面仍是 CSS 渐变字符串，没有图片上传（头像除外）
- 运费规则写死：满 59 免运费，否则 6 元
- 测试依赖本机路径常量（PHP、Edge），换机器要改 `tests/*.mjs` 顶部
