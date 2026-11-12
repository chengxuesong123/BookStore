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
            <router-link
                v-for="(b, i) in floats"
                :key="b.id"
                :to="`/book/${b.id}`"
                class="book-float"
                :class="`b${i + 1}`"
                :style="{ background: b.cover }"
            >
                <span class="bf-cat">{{ b.category_name }}</span>
                <span class="bf-title">{{ b.title }}</span>
            </router-link>
        </div>
    </section>

    <section class="section">
        <div class="section-head">
            <div><h2>分类精选</h2><p>按心情挑一个方向。</p></div>
            <router-link class="more" to="/books">全部图书</router-link>
        </div>
        <div class="promo-grid">
            <router-link
                v-for="(p, i) in promos"
                :key="p.category.id"
                :to="`/books?cat=${p.category.id}`"
                class="promo-card"
                :class="['promo-mint', 'promo-peach', 'promo-sky'][i % 3]"
            >
                <span class="promo-badge">{{ p.category.name }}</span>
                <div class="mini-book" :style="{ background: p.book ? p.book.cover : 'linear-gradient(150deg,#cfd9e6,#9fb0c4)' }"></div>
                <div>
                    <h3>{{ p.book ? p.book.title : '这个分类还在补货' }}</h3>
                    <p>{{ p.book ? p.book.author + ' · ' + money(p.book.price) : '过几天再来看看' }}</p>
                </div>
                <span class="btn btn-sm btn-ghost">去看看</span>
            </router-link>
        </div>
    </section>

    <section class="section">
        <div class="section-head">
            <div><h2>新书上架</h2><p>刚拆封的那几本。</p></div>
            <router-link class="more" to="/books">更多</router-link>
        </div>
        <div v-if="!loading && !newest.length" class="empty">
            <div class="empty-ico">📚</div>
            <h3>书还没到货</h3>
            <p>{{ loadError || '后台暂时没有可展示的图书。' }}</p>
            <button class="btn btn-primary" style="margin-top:14px" @click="load">重新加载</button>
        </div>
        <div v-else class="book-grid">
            <BookCard v-for="(b, i) in newest" :key="b.id" :book="b" :delay="i * 40" />
        </div>
    </section>

    <section class="section">
        <div class="section-head">
            <div><h2>热销榜单</h2><p>大家正在读的。</p></div>
            <router-link class="more" to="/books">更多</router-link>
        </div>
        <div v-if="!loading && !hot.length" class="empty">
            <div class="empty-ico">🔥</div>
            <h3>还没有热销数据</h3>
            <p>{{ loadError || '等有订单之后再来看看。' }}</p>
        </div>
        <div v-else class="book-grid">
            <BookCard v-for="(b, i) in hot" :key="b.id" :book="b" :delay="i * 40" />
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
const loading = ref(true);
const loadError = ref('');

const floats = computed(() => newest.value.slice(0, 2).concat(hot.value.slice(0, 1)).slice(0, 3));
const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function load() {
    loading.value = true;
    loadError.value = '';
    try {
        const [a, b, c] = await Promise.all([
            http.get('/books', { params: { page_size: 8 } }),
            http.get('/books', { params: { page_size: 8, sort: 'stock' } }),
            http.get('/categories'),
        ]);
        newest.value = a.data.list || [];
        hot.value = b.data.list || [];
        categories.value = c.data.list || [];

        promos.value = categories.value.slice(0, 3).map((category) => ({ category, book: null }));
        const firsts = await Promise.all(
            promos.value.map((p) => http.get('/books', { params: { cat: p.category.id, page_size: 1 } })),
        );
        promos.value = promos.value.map((p, i) => ({ ...p, book: firsts[i].data.list[0] || null }));
    } catch (e) {
        newest.value = [];
        hot.value = [];
        loadError.value = e.msg || '接口请求失败，检查后端是否启动。';
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>
