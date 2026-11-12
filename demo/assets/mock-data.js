/**
 * Demo 模拟数据（无后端，纯前端演示用）
 * 后续接 TP8 后，这里整体替换成接口返回的数据。
 */
window.MOCK = {
  categories: [
    { id: 'lit', name: '文学' },
    { id: 'hist', name: '历史' },
    { id: 'tech', name: '科技' },
    { id: 'econ', name: '经济' },
    { id: 'kid', name: '童书' },
    { id: 'soc', name: '社科' }
  ],
  books: [
    {
      id: 1, title: '活着', author: '余华', publisher: '作家出版社', price: 29.0, stock: 12,
      cat: 'lit', status: 'on',
      cover: 'linear-gradient(150deg, #8a3b2e, #5c2620)',
      intro: '地主少爷福贵一生的起落，从败光家产到孤身一人。余华用最干净的语言写尽苦难，却让"活着"本身成为一种力量。适合一口气读完，也适合过几年再读一遍。'
    },
    {
      id: 2, title: '平凡的世界', author: '路遥', publisher: '北京十月文艺出版社', price: 79.0, stock: 8,
      cat: 'lit', status: 'on',
      cover: 'linear-gradient(150deg, #6b6f3d, #42452a)',
      intro: '以孙少安、孙少平兄弟为主线，写黄土高原上普通人的奋斗与尊严。篇幅较长，建议分三册慢慢读。'
    },
    {
      id: 3, title: '百年孤独', author: '加西亚·马尔克斯', publisher: '南海出版公司', price: 55.0, stock: 5,
      cat: 'lit', status: 'on',
      cover: 'linear-gradient(150deg, #2f5d50, #1d3a32)',
      intro: '布恩迪亚家族七代人的兴衰，魔幻现实主义的代表作。人名容易绕晕，建议边读边画家族图谱。'
    },
    {
      id: 4, title: '围城', author: '钱锺书', publisher: '人民文学出版社', price: 39.0, stock: 0,
      cat: 'lit', status: 'on',
      cover: 'linear-gradient(150deg, #7a5a3a, #4f3823)',
      intro: '方鸿渐的留学、求职、婚恋三段经历。语言机锋密集，是中文讽刺小说的天花板之一。'
    },
    {
      id: 5, title: '万历十五年', author: '黄仁宇', publisher: '中华书局', price: 36.0, stock: 10,
      cat: 'hist', status: 'on',
      cover: 'linear-gradient(150deg, #3d4f6b, #263349)',
      intro: '从一个看似平淡的年份切入，剖析明代制度的深层困境。历史写法与叙事节奏都值得反复琢磨。'
    },
    {
      id: 6, title: '明朝那些事儿', author: '当年明月', publisher: '浙江人民出版社', price: 59.0, stock: 15,
      cat: 'hist', status: 'on',
      cover: 'linear-gradient(150deg, #8a6a2e, #5c4519)',
      intro: '用通俗笔法写明朝三百年。门槛低、可读性强，适合当作明史入门的第一本。'
    },
    {
      id: 7, title: '人类简史', author: '尤瓦尔·赫拉利', publisher: '中信出版社', price: 68.0, stock: 6,
      cat: 'hist', status: 'on',
      cover: 'linear-gradient(150deg, #55606e, #333b45)',
      intro: '从认知革命到科学革命，把人类历史串成一条大线索。观点大胆，读的时候可以带着质疑。'
    },
    {
      id: 8, title: '深入理解计算机系统', author: 'Randal E. Bryant', publisher: '机械工业出版社', price: 139.0, stock: 4,
      cat: 'tech', status: 'on',
      cover: 'linear-gradient(150deg, #2b3f5c, #182536)',
      intro: 'CSAPP，讲程序如何在机器上真正跑起来。书很厚，配套实验 CS:APP 值得做，是打底子的硬书。'
    },
    {
      id: 9, title: '代码整洁之道', author: 'Robert C. Martin', publisher: '人民邮电出版社', price: 59.0, stock: 9,
      cat: 'tech', status: 'on',
      cover: 'linear-gradient(150deg, #4c5b48, #2f3a2c)',
      intro: '命名、函数、注释、错误处理，一条条讲清楚什么样算好代码。适合团队共读，别只买不读。'
    },
    {
      id: 10, title: 'PHP 核心技术与最佳实践', author: '列旭松', publisher: '机械工业出版社', price: 89.0, stock: 7,
      cat: 'tech', status: 'on',
      cover: 'linear-gradient(150deg, #5a4a7a, #382c52)',
      intro: 'PHP 进阶向，涉及内核、性能、扩展等方面。做 ThinkPHP 项目时可以用来补底层认识。'
    },
    {
      id: 11, title: '经济学原理', author: 'N. 格里高利·曼昆', publisher: '北京大学出版社', price: 128.0, stock: 5,
      cat: 'econ', status: 'on',
      cover: 'linear-gradient(150deg, #7a4a3a, #4f2e22)',
      intro: '十大原理开篇，供需、市场、货币一路讲下来。教材属性强，适合系统学，不适合当闲书翻。'
    },
    {
      id: 12, title: '穷查理宝典', author: '彼得·考夫曼', publisher: '中信出版社', price: 88.0, stock: 3,
      cat: 'econ', status: 'on',
      cover: 'linear-gradient(150deg, #6e6238, #453c1e)',
      intro: '芒格的演讲与思维模型合集。多学科格栅、逆向思考，这些概念在书里被讲得很透气。'
    },
    {
      id: 13, title: '小王子', author: '圣埃克苏佩里', publisher: '人民文学出版社', price: 25.0, stock: 20,
      cat: 'kid', status: 'on',
      cover: 'linear-gradient(150deg, #4a6b8a, #2c4258)',
      intro: '写给大人的童话。篇幅很短，一晚上能读完，但关于驯养与责任的句子会留很久。'
    },
    {
      id: 14, title: '夏洛的网', author: 'E·B·怀特', publisher: '上海译文出版社', price: 28.0, stock: 18,
      cat: 'kid', status: 'on',
      cover: 'linear-gradient(150deg, #6b7a45, #414c27)',
      intro: '小猪威尔伯和蜘蛛夏洛的友谊。适合小学中高年级独立阅读，也适合亲子共读。'
    },
    {
      id: 15, title: '乡土中国', author: '费孝通', publisher: '北京大学出版社', price: 29.0, stock: 14,
      cat: 'soc', status: 'on',
      cover: 'linear-gradient(150deg, #5c5142, #38302a)',
      intro: '差序格局、礼治秩序、无讼这些概念都出自这里。薄薄一本，是理解中国社会的入门钥匙。'
    },
    {
      id: 16, title: '娱乐至死', author: '尼尔·波兹曼', publisher: '中信出版社', price: 45.0, stock: 2,
      cat: 'soc', status: 'on',
      cover: 'linear-gradient(150deg, #79406b, #4b2843)',
      intro: '讨论媒介如何塑造认知。写于电视时代，放到短视频时代读反而更刺人。库存紧张。'
    }
  ]
};
