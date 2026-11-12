// v3 演示数据（由数据库种子生成，仅 mock 模式使用）
export const categories = [
    {
        "id": 1,
        "name": "文学",
        "sort": 10
    },
    {
        "id": 2,
        "name": "历史",
        "sort": 20
    },
    {
        "id": 3,
        "name": "科技",
        "sort": 30
    },
    {
        "id": 4,
        "name": "经济",
        "sort": 40
    },
    {
        "id": 5,
        "name": "童书",
        "sort": 50
    },
    {
        "id": 6,
        "name": "社科",
        "sort": 60
    }
];

export const books = [
    {
        "id": 1,
        "title": "活着",
        "author": "余华",
        "publisher": "作家出版社",
        "category_id": 1,
        "category_name": "文学",
        "price": 29,
        "original_price": 39,
        "stock": 12,
        "cover": "linear-gradient(150deg, #8a3b2e, #5c2620)",
        "intro": "地主少爷福贵一生的起落，从败光家产到孤身一人。余华用最干净的语言写尽苦难，却让「活着」本身成为一种力量。适合一口气读完，也适合过几年再读一遍。",
        "tags": "经典,当代文学",
        "tag_list": [
            "经典",
            "当代文学"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 2,
        "title": "平凡的世界",
        "author": "路遥",
        "publisher": "北京十月文艺出版社",
        "category_id": 1,
        "category_name": "文学",
        "price": 79,
        "original_price": 98,
        "stock": 8,
        "cover": "linear-gradient(150deg, #6b6f3d, #42452a)",
        "intro": "以孙少安、孙少平兄弟为主线，写黄土高原上普通人的奋斗与尊严。篇幅较长，建议分三册慢慢读。",
        "tags": "茅盾文学奖,成长",
        "tag_list": [
            "茅盾文学奖",
            "成长"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 3,
        "title": "百年孤独",
        "author": "加西亚·马尔克斯",
        "publisher": "南海出版公司",
        "category_id": 1,
        "category_name": "文学",
        "price": 55,
        "original_price": 68,
        "stock": 5,
        "cover": "linear-gradient(150deg, #2f5d50, #1d3a32)",
        "intro": "布恩迪亚家族七代人的兴衰，魔幻现实主义的代表作。人名容易绕晕，建议边读边画家族图谱。",
        "tags": "诺奖,魔幻现实主义",
        "tag_list": [
            "诺奖",
            "魔幻现实主义"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 4,
        "title": "围城",
        "author": "钱锺书",
        "publisher": "人民文学出版社",
        "category_id": 1,
        "category_name": "文学",
        "price": 39,
        "original_price": 45,
        "stock": 0,
        "cover": "linear-gradient(150deg, #7a5a3a, #4f3823)",
        "intro": "方鸿渐的留学、求职、婚恋三段经历。语言机锋密集，是中文讽刺小说的天花板之一。",
        "tags": "讽刺,经典",
        "tag_list": [
            "讽刺",
            "经典"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 5,
        "title": "万历十五年",
        "author": "黄仁宇",
        "publisher": "中华书局",
        "category_id": 2,
        "category_name": "历史",
        "price": 36,
        "original_price": 48,
        "stock": 10,
        "cover": "linear-gradient(150deg, #3d4f6b, #263349)",
        "intro": "从一个看似平淡的年份切入，剖析明代制度的深层困境。历史写法与叙事节奏都值得反复琢磨。",
        "tags": "明史,大历史观",
        "tag_list": [
            "明史",
            "大历史观"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 6,
        "title": "明朝那些事儿",
        "author": "当年明月",
        "publisher": "浙江人民出版社",
        "category_id": 2,
        "category_name": "历史",
        "price": 59,
        "original_price": 79,
        "stock": 15,
        "cover": "linear-gradient(150deg, #8a6a2e, #5c4519)",
        "intro": "用通俗笔法写明朝三百年。门槛低、可读性强，适合当作明史入门的第一本。",
        "tags": "通俗历史",
        "tag_list": [
            "通俗历史"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 7,
        "title": "人类简史",
        "author": "尤瓦尔·赫拉利",
        "publisher": "中信出版社",
        "category_id": 2,
        "category_name": "历史",
        "price": 68,
        "original_price": 88,
        "stock": 6,
        "cover": "linear-gradient(150deg, #55606e, #333b45)",
        "intro": "从认知革命到科学革命，把人类历史串成一条大线索。观点大胆，读的时候可以带着质疑。",
        "tags": "通识,畅销",
        "tag_list": [
            "通识",
            "畅销"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 8,
        "title": "深入理解计算机系统",
        "author": "Randal E. Bryant",
        "publisher": "机械工业出版社",
        "category_id": 3,
        "category_name": "科技",
        "price": 139,
        "original_price": 168,
        "stock": 4,
        "cover": "linear-gradient(150deg, #2b3f5c, #182536)",
        "intro": "CSAPP，讲程序如何在机器上真正跑起来。书很厚，配套实验 CS:APP 值得做，是打底子的硬书。",
        "tags": "计算机,经典教材",
        "tag_list": [
            "计算机",
            "经典教材"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 9,
        "title": "代码整洁之道",
        "author": "Robert C. Martin",
        "publisher": "人民邮电出版社",
        "category_id": 3,
        "category_name": "科技",
        "price": 59,
        "original_price": 69,
        "stock": 9,
        "cover": "linear-gradient(150deg, #4c5b48, #2f3a2c)",
        "intro": "命名、函数、注释、错误处理，一条条讲清楚什么样算好代码。适合团队共读，别只买不读。",
        "tags": "工程实践",
        "tag_list": [
            "工程实践"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 10,
        "title": "PHP 核心技术与最佳实践",
        "author": "列旭松",
        "publisher": "机械工业出版社",
        "category_id": 3,
        "category_name": "科技",
        "price": 89,
        "original_price": 99,
        "stock": 7,
        "cover": "linear-gradient(150deg, #5a4a7a, #382c52)",
        "intro": "PHP 进阶向，涉及内核、性能、扩展等方面。做 ThinkPHP 项目时可以用来补底层认识。",
        "tags": "PHP,进阶",
        "tag_list": [
            "PHP",
            "进阶"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 11,
        "title": "经济学原理",
        "author": "N. 格里高利·曼昆",
        "publisher": "北京大学出版社",
        "category_id": 4,
        "category_name": "经济",
        "price": 128,
        "original_price": 158,
        "stock": 5,
        "cover": "linear-gradient(150deg, #7a4a3a, #4f2e22)",
        "intro": "十大原理开篇，供需、市场、货币一路讲下来。教材属性强，适合系统学，不适合当闲书翻。",
        "tags": "教材,入门",
        "tag_list": [
            "教材",
            "入门"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 12,
        "title": "穷查理宝典",
        "author": "彼得·考夫曼",
        "publisher": "中信出版社",
        "category_id": 4,
        "category_name": "经济",
        "price": 88,
        "original_price": 108,
        "stock": 3,
        "cover": "linear-gradient(150deg, #6e6238, #453c1e)",
        "intro": "芒格的演讲与思维模型合集。多学科格栅、逆向思考，这些概念在书里被讲得很透气。",
        "tags": "投资,思维模型",
        "tag_list": [
            "投资",
            "思维模型"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 13,
        "title": "小王子",
        "author": "圣埃克苏佩里",
        "publisher": "人民文学出版社",
        "category_id": 5,
        "category_name": "童书",
        "price": 25,
        "original_price": 32,
        "stock": 20,
        "cover": "linear-gradient(150deg, #4a6b8a, #2c4258)",
        "intro": "写给大人的童话。篇幅很短，一晚上能读完，但关于驯养与责任的句子会留很久。",
        "tags": "童话,治愈",
        "tag_list": [
            "童话",
            "治愈"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 14,
        "title": "夏洛的网",
        "author": "E·B·怀特",
        "publisher": "上海译文出版社",
        "category_id": 5,
        "category_name": "童书",
        "price": 28,
        "original_price": 36,
        "stock": 18,
        "cover": "linear-gradient(150deg, #6b7a45, #414c27)",
        "intro": "小猪威尔伯和蜘蛛夏洛的友谊。适合小学中高年级独立阅读，也适合亲子共读。",
        "tags": "童书,友谊",
        "tag_list": [
            "童书",
            "友谊"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 15,
        "title": "乡土中国",
        "author": "费孝通",
        "publisher": "北京大学出版社",
        "category_id": 6,
        "category_name": "社科",
        "price": 29,
        "original_price": 39,
        "stock": 14,
        "cover": "linear-gradient(150deg, #5c5142, #38302a)",
        "intro": "差序格局、礼治秩序、无讼这些概念都出自这里。薄薄一本，是理解中国社会的入门钥匙。",
        "tags": "社会学,入门",
        "tag_list": [
            "社会学",
            "入门"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 16,
        "title": "娱乐至死",
        "author": "尼尔·波兹曼",
        "publisher": "中信出版社",
        "category_id": 6,
        "category_name": "社科",
        "price": 45,
        "original_price": 55,
        "stock": 2,
        "cover": "linear-gradient(150deg, #79406b, #4b2843)",
        "intro": "讨论媒介如何塑造认知。写于电视时代，放到短视频时代读反而更刺人。库存紧张。",
        "tags": "媒介,批判",
        "tag_list": [
            "媒介",
            "批判"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 17,
        "title": "解忧杂货店",
        "author": "东野圭吾",
        "publisher": "南海出版公司",
        "category_id": 1,
        "category_name": "文学",
        "price": 39.5,
        "original_price": 49.5,
        "stock": 11,
        "cover": "linear-gradient(150deg, #b0673f, #7a3f22)",
        "intro": "五个故事通过一间杂货店的投信口串起来。结构精巧，情绪收得很稳，适合当睡前读物。",
        "tags": "日系,温情",
        "tag_list": [
            "日系",
            "温情"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    },
    {
        "id": 18,
        "title": "设计中的设计",
        "author": "原研哉",
        "publisher": "山东人民出版社",
        "category_id": 6,
        "category_name": "社科",
        "price": 68,
        "original_price": 78,
        "stock": 7,
        "cover": "linear-gradient(150deg, #6d7f72, #44534a)",
        "intro": "把「设计」从装饰拉回日常。留白、空、无印良品的那套思考，读完看东西的眼光会变。",
        "tags": "设计,日本",
        "tag_list": [
            "设计",
            "日本"
        ],
        "status": "on",
        "created_at": "2026-11-12 21:23:20"
    }
];
