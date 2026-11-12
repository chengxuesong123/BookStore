-- 图书商城 MVP 库表（MySQL 5.7+ / 8.0）
-- 说明见 docs/产品设计.md 第 6 节
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `books`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`         VARCHAR(120) NOT NULL COMMENT '登录邮箱',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'password_hash() 结果',
  `nickname`      VARCHAR(40)  NOT NULL,
  `avatar`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '头像相对路径',
  `role`          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户与管理员';

CREATE TABLE `categories` (
  `id`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(40) NOT NULL,
  `sort` INT NOT NULL DEFAULT 0 COMMENT '数字小的排前面',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='单层分类';

CREATE TABLE `books` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id`    INT UNSIGNED NOT NULL,
  `title`          VARCHAR(120) NOT NULL,
  `author`         VARCHAR(80)  NOT NULL DEFAULT '',
  `publisher`      VARCHAR(80)  NOT NULL DEFAULT '',
  `price`          DECIMAL(10,2) NOT NULL,
  `original_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock`          INT NOT NULL DEFAULT 0,
  `cover`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'CSS 渐变或图片路径',
  `intro`          TEXT NULL,
  `tags`           VARCHAR(120) NOT NULL DEFAULT '' COMMENT '逗号分隔',
  `status`         ENUM('on','off') NOT NULL DEFAULT 'on',
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_books_category` (`category_id`),
  KEY `idx_books_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图书';

CREATE TABLE `cart_items` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `book_id`    INT UNSIGNED NOT NULL,
  `quantity`   INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cart_user_book` (`user_id`,`book_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='购物车（仅登录用户落库）';

CREATE TABLE `orders` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_no`     VARCHAR(32) NOT NULL,
  `user_id`      INT UNSIGNED NOT NULL,
  `receiver`     VARCHAR(40) NOT NULL,
  `phone`        VARCHAR(20) NOT NULL,
  `address`      VARCHAR(255) NOT NULL,
  `remark`       VARCHAR(255) NOT NULL DEFAULT '',
  `total_amount` DECIMAL(10,2) NOT NULL,
  `status`       ENUM('pending','paid','shipped','done','cancelled') NOT NULL DEFAULT 'pending',
  `source`       ENUM('cart','direct') NOT NULL DEFAULT 'cart' COMMENT '下单来源',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_no` (`order_no`),
  KEY `idx_orders_user` (`user_id`,`created_at`),
  KEY `idx_orders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单';

CREATE TABLE `order_items` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`   INT UNSIGNED NOT NULL,
  `book_id`    INT UNSIGNED NOT NULL,
  `book_title` VARCHAR(120) NOT NULL COMMENT '下单时书名快照',
  `cover`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '下单时封面快照',
  `price`      DECIMAL(10,2) NOT NULL COMMENT '下单时单价快照',
  `quantity`   INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_items_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细（存快照）';
