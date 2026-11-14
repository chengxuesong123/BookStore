<template>
    <div>
        <div class="admin-head">
            <div>
                <h1>图书管理</h1>
                <div class="who">共 {{ total }} 本，下架的书前台不展示</div>
            </div>
            <router-link class="btn btn-primary btn-sm" to="/admin/books/new">+ 新增图书</router-link>
        </div>

        <div class="toolbar">
            <form class="search-box" @submit.prevent="search">
                <input v-model="draft" type="search" placeholder="按书名搜索">
                <button class="btn btn-primary" type="submit">搜索</button>
            </form>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                <tr><th>ID</th><th>书名</th><th>分类</th><th>现价</th><th>库存</th><th>状态</th><th>操作</th></tr>
                </thead>
                <tbody>
                <tr v-for="b in list" :key="b.id">
                    <td>{{ b.id }}</td>
                    <td>{{ b.title }}</td>
                    <td>{{ b.category_name || '-' }}</td>
                    <td>{{ money(b.price) }}</td>
                    <td>{{ b.stock }}</td>
                    <td><span class="pill" :class="b.status === 'on' ? 'pill-done' : 'pill-cancelled'">{{ b.status === 'on' ? '在售' : '已下架' }}</span></td>
                    <td>
                        <div class="actions">
                            <router-link class="btn btn-sm btn-ghost" :to="`/admin/books/${b.id}/edit`">编辑</router-link>
                            <button class="btn btn-sm btn-ghost" type="button" @click="toggle(b)">{{ b.status === 'on' ? '下架' : '上架' }}</button>
                            <button class="btn btn-sm btn-ghost" type="button" @click="remove(b)">删除</button>
                        </div>
                    </td>
                </tr>
                <tr v-if="!list.length && !loading"><td colspan="7" class="muted" style="text-align:center;padding:30px">没有图书</td></tr>
                </tbody>
            </table>
        </div>

        <Pager :page="page" :pages="pages" @change="go" />
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/client';
import Pager from '../../components/Pager.vue';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const list = ref([]);
const total = ref(0);
const loading = ref(true);
const draft = ref('');

const kw = computed(() => String(route.query.q || ''));
const page = computed(() => Math.max(1, Number(route.query.page || 1)));
const pages = computed(() => Math.max(1, Math.ceil(total.value / 12)));
const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function load() {
    loading.value = true;
    try {
        const res = await http.get('/admin/books', { params: { q: kw.value, page: page.value } });
        list.value = res.data.list;
        total.value = res.data.total;
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        loading.value = false;
    }
}

function search() {
    const q = draft.value.trim();
    router.push({ path: '/admin/books', query: q ? { q } : {} });
}

function go(p) {
    if (p < 1 || p > pages.value) return;
    router.push({ path: '/admin/books', query: { ...(kw.value ? { q: kw.value } : {}), ...(p > 1 ? { page: p } : {}) } });
}

async function toggle(b) {
    try {
        const res = await http.patch(`/admin/books/${b.id}/status`);
        b.status = res.data.book.status;
        ui.toast(res.msg);
    } catch (e) {
        ui.toast(e.msg, 'error');
    }
}

async function remove(b) {
    if (!window.confirm(`确定删除《${b.title}》？购物车里的这本书会一并移除。`)) return;
    try {
        await http.delete(`/admin/books/${b.id}`);
        ui.toast('已删除');
        await load();
    } catch (e) {
        ui.toast(e.msg, 'error');
    }
}

onMounted(() => {
    draft.value = kw.value;
    load();
});

watch(() => route.fullPath, () => {
    draft.value = kw.value;
    load();
});
</script>
