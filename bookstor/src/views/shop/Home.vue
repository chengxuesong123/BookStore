<template>
    <section class="hero">
        <div class="hero-copy">
            <span class="eyebrow">MOYU BOOKS · 慢慢读</span>
            <h1>把一本书<br>读到卷边。</h1>
            <p>文学、历史、科技、经济、童书、社科。十八本精选纸书，从任意一本开始。</p>
            <div class="hero-actions">
                <router-link class="btn btn-primary" to="/books">开始选书</router-link>
                <router-link class="btn btn-ghost" to="/books?sort=price-asc">看看便宜的</router-link>
            </div>
        </div>
        <div class="hero-books">
            <router-link v-for="(b, i) in floats" :key="b.id" :to="`/book/${b.id}`" class="float-book" :class="`f${i}`" :style="{ background: b.cover }">
                <span class="fb-cat">{{ b.category_name }}</span>
                <span class="fb-title">{{ b.title }}</span>
            </router-link>
        </div>
    </section>

    <section class="section">
        <div class="section-head">
            <div><h2>分类精选</h2><p>按心情挑一个方向。</p></div>
            <router-link class="more" to="/books">全部图书</router-link>
        </div>
        <div class="promo-grid">
            <router-link v-for="(p, i) in promos" :key="p.category.id" :to="`/books?cat=${p.category.id}`" class="promo-card" :class="`c${i}`">
                <div class="promo-cover" :style="{ background: p.book ? p.book.cover : '' }">{{ p.book ? p.book.title : '待上架' }}</div>
                <div class="promo-body">
                    <div class="promo-cat">{{ p.category.name }}</div>
                    <h3>{{ p.book ? p.book.title : '这个分类还在补货' }}</h3>
                    <p>{{ p.book ? p.book.author + ' · ' + money(p.book.price) : '过几天再来看看' }}</p>
                </div>
            </router-link>
        </div>
    </section>

    <section class="section">
        <div class="section-head">
            <div><h2>新书上架</h2><p>刚拆封的那几本。</p></div>
            <router-link class="more" to="/books">更多</router-link>
        </div>
        <div class="book-grid">
            <BookCard v-for="b in newest" :key="b.id" :book="b" />
        </div>
    </section>

    <section class="section">
        <div class="section-head">
            <div><h2>热销榜单</h2><p>大家正在读的。</p></div>
            <router-link class="more" to="/books">更多</router-link>
        </div>
        <div class="book-grid">
            <BookCard v-for="b in hot" :key="b.id" :book="b" />
        </div>
    </section>

    <section class="feature-strip">
        <div class="feature"><span>📦</span><b>满 59 包邮</b><p>凑单不难</p></div>
        <div class="feature"><span>🕒</span><b>48 小时发货</b><p>不拖</p></div>
        <div class="feature"><span>🛡</span><b>七天退换</b><p>放心买</p></div>
        <div class="feature"><span>📚</span><b>正品纸书</b><p>不是电子版</p></div>
    </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import BookCard from '../../components/BookCard.vue';
import { http } from '../../api/client';

const newest = ref([]);
const hot = ref([]);
const categories = ref([]);
const promos = ref([]);

const floats = computed(() => newest.value.slice(0, 2).concat(hot.value.slice(0, 1)));

const money = (n) => '¥' + Number(n || 0).toFixed(2);

onMounted(async () => {
    try {
        const [a, b, c] = await Promise.all([
            http.get('/books', { params: { page_size: 8 } }),
            http.get('/books', { params: { page_size: 8, sort: 'stock' } }),
            http.get('/categories'),
        ]);
        newest.value = a.data.list;
        hot.value = b.data.list;
        categories.value = c.data.list;
        promos.value = categories.value.slice(0, 3).map((category) => ({ category, book: null }));

        const firsts = await Promise.all(
            promos.value.map((p) => http.get('/books', { params: { cat: p.category.id, page_size: 1 } })),
        );
        promos.value = promos.value.map((p, i) => ({ ...p, book: firsts[i].data.list[0] || null }));
    } catch (e) {
        // 首页失败时保持空状态，不挡浏览
    }
});
</script>
