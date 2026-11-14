-- 种子数据（v5）：6 个分类 + 1 个管理员
-- 管理员：admin@moyu.com / admin123
-- 书籍由 database/books-real.csv 通过 php think books:import 导入（db:init --seed 会自动执行）
SET NAMES utf8mb4;

DELETE FROM `categories`;
DELETE FROM `users`;

INSERT INTO `users` (`id`,`email`,`password_hash`,`nickname`,`role`) VALUES
(1,'admin@moyu.com','$2y$10$R5ShDYJgvF9xIdUDDC8CI.hNvZ1yimxO5EZfK3aQQvA6O9o4Y0AQu','店长','admin');

INSERT INTO `categories` (`id`,`name`,`sort`) VALUES
(1,'文学',10),
(2,'历史',20),
(3,'科技',30),
(4,'经济',40),
(5,'童书',50),
(6,'社科',60);
