<template>
    <div class="page-head">
        <div>
            <h1>全部图书</h1>
            <div class="sub">共 {{ total }} 本</div>
        </div>
    </div>

    <div class="toolbar">
        <form class="search-box" @submit.prevent="onSearch">
            <input v-model="draft" type="search" placeholder="搜书名、作者、出版社">
            <button class="btn btn-primary" type="submit">搜索</button>
        </form>
        <select v-model="sort" class="select" @change="applyQuery({ sort, page: 1 })">
            <option value="default">默认排序</option>
            <option value="price-asc">价格从低到高</option>
            <option value="price-desc">价格从高到低</option>
        </select>
    </div>

    <div class="chip-row">
        <a class="chip" :class="{ active: !cat }" href="#" @click.prevent="applyQuery({ cat: '', page: 1 })">全部</a>
        <a v-for="c in categories" :key="c.id" class="chip" :class="{ active: String(cat) === String(c.id) }"
           href="#" @click.prevent="applyQuery({ cat: c.id, page: 1 })">{{ c.name }}</a>
    </div>

    <p v-if="kw || cat" class="result-line">
        <span v-if="kw">关键词「{{ kw }}」</span>
        <span>{{ total }} 条结果</span>
    </p>

    <div v-if="loading" class="empty"><div class="empty-ico">…</div><h3>正在翻书</h3></div>
    <div v-else-if="!list.length" class="empty">
        <div class="empty-ico">🔍</div>
        <h3>没有找到符合条件的书</h3>
        <p>换个关键词或分类试试。</p>
    </div>
    <template v-else>
        <p class="list-meta">共 {{ total }} 本，每页 10 本，第 {{ page }} / {{ pages }} 页</p>
        <div class="book-grid">
            <BookCard v-for="b in list" :key="b.id" :book="b" />
        </div>

        <Pager :page="page" :pages="pages" @change="go" />
    </template>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BookCard from '../../components/BookCard.vue';
import Pager from '../../components/Pager.vue';
import { http } from '../../api/client';

const route = useRoute();
const router = useRouter();

const list = ref([]);
const categories = ref([]);
const total = ref(0);
const loading = ref(true);
const draft = ref('');

const kw = computed(() => String(route.query.q || ''));
const cat = computed(() => String(route.query.cat || ''));
const sort = computed({
    get: () => String(route.query.sort || 'default'),
    set: (v) => applyQuery({ sort: v, page: 1 }),
});
const page = computed(() => Math.max(1, Number(route.query.page || 1)));
const pages = computed(() => Math.max(1, Math.ceil(total.value / 10)));

function applyQuery(patch) {
    const query = { ...route.query, ...patch };
    Object.keys(query).forEach((k) => {
        if (query[k] === '' || query[k] === null || query[k] === undefined) delete query[k];
    });
    if (query.sort === 'default') delete query.sort;
    if (query.page === 1) delete query.page;
    router.push({ path: '/books', query });
}

function onSearch() {
    applyQuery({ q: draft.value.trim(), page: 1 });
}

function go(p) {
    if (p < 1 || p > pages.value) return;
    applyQuery({ page: p });
}

async function load() {
    loading.value = true;
    try {
        const res = await http.get('/books', {
            params: {
                q: kw.value,
                cat: cat.value || 0,
                sort: sort.value,
                page: page.value,
                page_size: 10,
            },
        });
        list.value = res.data.list;
        total.value = res.data.total;
    } catch (e) {
        list.value = [];
        total.value = 0;
    } finally {
        loading.value = false;
    }
}

watch(() => route.fullPath, () => {
    draft.value = kw.value;
    load();
});

onMounted(async () => {
    draft.value = kw.value;
    try {
        const res = await http.get('/categories');
        categories.value = res.data.list;
    } catch (e) {
        categories.value = [];
    }
    load();
});
</script>
