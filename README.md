# 墨屿书屋 · 图书商城（TP8 + MySQL）

按 `docs/产品设计.md` 实现的图书商城 MVP：服务端渲染、真实数据库、真实登录与订单流转。
`demo/` 目录是早期的纯前端原型，只作视觉参考，不参与运行。

## 技术栈

- ThinkPHP 8.1（PHP 8.3）
- MySQL 5.7（utf8mb4，InnoDB）
- think-template 服务端模板 + jQuery 增强（无前端框架）
- 原生 CSS（复用原型设计语言）

## 目录速览

```
app/controller/          前台：Index / Book / Cart / Order / User
app/controller/admin/    后台：Index / Book / Order / Category
app/model/               users / categories / books / cart_items / orders / order_items
app/service/CartService  购物车（游客 session + 登录落库 + 登录合并 + 金额计算）
app/middleware/          AdminAuth（后台鉴权）、VerifyCsrf（表单 CSRF）
app/command/DbInit       建表 + 种子数据
database/                schema.sql / seed.sql
view/                    服务端模板（public/header、public/footer 为公共片段）
public/static/           css / js / vendor（jQuery）
tests/e2e.mjs            Edge CDP 端到端测试
docs/产品设计.md          产品需求与验收标准
```

## 环境要求

- PHP 8.1+，扩展：pdo_mysql、mbstring、openssl
- MySQL 5.7+
- Composer（安装依赖）
- 测试可选：Node 20+、Microsoft Edge

## 安装

```powershell
composer install

# 复制并修改数据库配置
Copy-Item .example.env .env
# 编辑 .env：DB_HOST / DB_NAME / DB_USER / DB_PASS / DB_PORT

# 建表 + 导入演示数据（会删表重建！）
php think db:init --seed --force
```

## 启动

```powershell
php -S 127.0.0.1:8124 -t public public/router.php
```

打开 http://127.0.0.1:8124

## 演示账号

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | admin@moyu.com | admin123 |
| 顾客 | 自行注册 | 至少 6 位 |

后台入口：`/admin`（前台导航不显示，游客访问会跳转登录页，顾客访问回首页并提示无权限）。

## 功能

前台

- 首页：分类导航、新书、热销、分类精选
- 图书列表：关键词搜索（书名/作者/出版社）、分类筛选、价格排序、分页
- 图书详情：简介、库存、同类推荐、加入购物车 / 立即购买
- 购物车：游客可用（session），登录后自动合并落库，数量增减与删除
- 结算下单：收货信息校验、服务端重算金额、事务扣库存、订单快照
- 我的订单：列表、详情、归属校验
- 订单流转：待付款 →（模拟付款）已付款 →（后台发货）已发货 →（确认收货）已完成；待付款可取消并回补库存

后台（`/admin`，管理员中间件保护）

- 概览：图书 / 在售 / 订单 / 待发货统计
- 图书管理：新增、编辑、上下架、删除（删除会清购物车引用，历史订单用快照不变）
- 订单管理：按状态筛选、搜索、发货、设为完成、取消
- 分类管理：新增、重命名、排序、删除（分类下有书时拒绝）

## 数据与安全

- 金额、库存一律服务端计算；下单在事务内用 `stock >= qty` 条件扣减，失败即回滚
- 订单明细保存书名/封面/单价快照，商品改价或删除不影响历史订单
- 密码 `password_hash` 存储；登录失败不区分「账号不存在」与「密码错误」
- POST 全部校验 CSRF token（`_token`），缺失或错误返回 419
- 后台权限由 `AdminAuth` 中间件强制校验，不只是隐藏入口
- 模板默认转义输出，防 XSS

## 测试

端到端测试会真实操作浏览器与数据库，先启动服务，再启动 Edge（headless + CDP）：

```powershell
# 1) 启动站点
php -S 127.0.0.1:8124 -t public public/router.php

# 2) 启动 Edge（另开一个窗口，保持运行）
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir=.\\tests\\.edge-profile

# 3) 跑测试（--reset 会重置数据库后再测）
node tests/e2e.mjs --reset
```

当前覆盖 18 组、110 项断言：首页布局、静态资源、注册登录、后台越权、图书 CRUD、搜索筛选排序分页、游客购物车合并、下单扣库存、订单状态流转、取消回补库存、订单归属、分类管理、CSRF。

## 已知限制

- 支付是模拟的，没有接支付渠道
- 没有图片上传，封面使用 CSS 渐变字符串
- 没有运费规则后台配置，固定满 59 免运费、否则 6 元
- 测试依赖本机 PHP / MySQL / Edge 路径（见 `tests/e2e.mjs` 顶部常量）
