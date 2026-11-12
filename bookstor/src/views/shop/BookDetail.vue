<template>
    <div v-if="book">
        <div class="crumb">
            <router-link to="/">首页</router-link> /
            <router-link to="/books">全部图书</router-link> / {{ book.title }}
        </div>

        <div class="detail">
            <div class="detail-cover" :style="{ background: book.cover }">
                <span class="dc-cat">{{ book.category_name }}</span>
                <div>
                    <div class="dc-title">{{ book.title }}</div>
                    <div class="dc-author">{{ book.author }}</div>
                </div>
            </div>

            <div class="detail-info">
                <span class="badge-cat">{{ book.category_name }}</span>
                <h1>{{ book.title }}</h1>
                <div class="detail-meta">{{ book.author }}　·　{{ book.publisher }}</div>

                <div class="detail-price-row">
                    <span class="price">{{ money(book.price) }}</span>
                    <span class="price-old">{{ money(book.original_price) }}</span>
                    <span v-if="book.stock > 0" class="stock">库存 {{ book.stock }} 本</span>
                    <span v-else class="stock stock-out">暂时缺货</span>
                </div>

                <div class="buy-row">
                    <div class="qty">
                        <button type="button" :disabled="qty <= 1" @click="qty--">−</button>
                        <input v-model.number="qty" inputmode="numeric" @change="clampQty">
                        <button type="button" :disabled="qty >= book.stock" @click="qty++">+</button>
                    </div>
                    <button class="btn btn-primary" type="button" :disabled="book.stock <= 0 || adding" @click="addToCart">
                        加入购物车
                    </button>
                    <button class="btn btn-ghost" type="button" :disabled="book.stock <= 0" @click="buyNow">立即购买</button>
                </div>

                <div class="detail-cards">
                    <div class="info-card">
                        <h3>内容简介</h3>
                        <p>{{ book.intro || '这本书还没写简介。' }}</p>
                    </div>
                    <div class="info-card">
                        <h3>图书信息</h3>
                        <div class="info-grid">
                            <div><div class="k">作者</div><div class="v">{{ book.author }}</div></div>
                            <div><div class="k">出版社</div><div class="v">{{ book.publisher }}</div></div>
                            <div><div class="k">分类</div><div class="v">{{ book.category_name }}<template v-if="book.tag_list.length">，{{ book.tag_list.join(' / ') }}</template></div></div>
                            <div><div class="k">定价</div><div class="v">{{ money(book.original_price) }}（现价 {{ money(book.price) }}）</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <section v-if="related.length" class="section">
            <div class="section-head">
                <div><h2>同类推荐</h2><p>看完这本，再看看这些。</p></div>
                <router-link class="more" :to="`/books?cat=${book.category_id}`">同类图书</router-link>
            </div>
            <div class="book-grid">
                <BookCard v-for="b in related" :key="b.id" :book="b" />
            </div>
        </section>
    </div>
    <div v-else-if="error" class="empty">
        <div class="empty-ico">📕</div>
        <h3>{{ error }}</h3>
        <router-link class="btn btn-primary" to="/books" style="margin-top:14px">回图书列表</router-link>
    </div>
    <div v-else class="empty"><div class="empty-ico">…</div><h3>正在取书</h3></div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BookCard from '../../components/BookCard.vue';
import { http } from '../../api/client';
import { useCartStore } from '../../stores/cart';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const cart = useCartStore();
const ui = useUiStore();

const book = ref(null);
const related = ref([]);
const qty = ref(1);
const error = ref('');
const adding = ref(false);

const money = (n) => '¥' + Number(n || 0).toFixed(2);

function clampQty() {
    const max = book.value ? book.value.stock : 1;
    qty.value = Math.max(1, Math.min(Number(qty.value) || 1, Math.max(1, max)));
}

async function load(id) {
    error.value = '';
    book.value = null;
    related.value = [];
    qty.value = 1;
    try {
        const res = await http.get(`/books/${id}`);
        book.value = res.data.book;
        related.value = res.data.related;
    } catch (e) {
        error.value = e.status === 404 ? '图书不存在或已下架' : '加载失败，稍后再试';
    }
}

async function addToCart() {
    if (!book.value) return;
    adding.value = true;
    try {
        await cart.add(book.value.id, qty.value);
        ui.toast('已加入购物车');
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        adding.value = false;
    }
}

function buyNow() {
    if (!book.value) return;
    router.push({ path: '/checkout', query: { mode: 'direct', book_id: book.value.id, qty: qty.value } });
}

watch(() => route.params.id, (id) => id && load(id));
onMounted(() => load(route.params.id));
</script>
