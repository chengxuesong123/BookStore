<template>
    <div>
        <div class="admin-head">
            <div>
                <h1>订单管理</h1>
                <div class="who">共 {{ total }} 单</div>
            </div>
        </div>

        <div class="toolbar">
            <form class="search-box" @submit.prevent="search">
                <input v-model="draft" type="search" placeholder="订单号或顾客邮箱">
                <select v-model="status" class="select" style="width:auto" @change="apply({ status, page: 1 })">
                    <option value="">全部状态</option>
                    <option value="pending">待付款</option>
                    <option value="paid">待发货</option>
                    <option value="shipped">已发货</option>
                    <option value="done">已完成</option>
                    <option value="cancelled">已取消</option>
                </select>
                <button class="btn btn-primary" type="submit">筛选</button>
            </form>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                <tr><th>订单号</th><th>顾客</th><th>金额</th><th>来源</th><th>状态</th><th>下单时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                <tr v-for="o in list" :key="o.id">
                    <td>{{ o.order_no }}</td>
                    <td>{{ o.nickname || '-' }}<br><small class="muted">{{ o.email }}</small></td>
                    <td>{{ money(o.total_amount) }}</td>
                    <td>{{ o.source === 'direct' ? '立即购买' : '购物车' }}</td>
                    <td><span class="pill" :class="'pill-' + o.status">{{ o.status_text }}</span></td>
                    <td>{{ o.created_at }}</td>
                    <td><router-link class="btn btn-sm btn-ghost" :to="`/admin/orders/${o.id}`">处理</router-link></td>
                </tr>
                <tr v-if="!list.length"><td colspan="7" class="muted" style="text-align:center;padding:30px">没有订单</td></tr>
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
const draft = ref('');
const status = ref(String(route.query.status || ''));

const kw = computed(() => String(route.query.q || ''));
const page = computed(() => Math.max(1, Number(route.query.page || 1)));
const pages = computed(() => Math.max(1, Math.ceil(total.value / 12)));
const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function load() {
    try {
        const res = await http.get('/admin/orders', {
            params: { status: status.value || '', q: kw.value, page: page.value },
        });
        list.value = res.data.list;
        total.value = res.data.total;
    } catch (e) {
        ui.toast(e.msg, 'error');
    }
}

function apply(patch) {
    const query = { status: status.value || '', q: kw.value, page: page.value, ...patch };
    Object.keys(query).forEach((k) => {
        if (query[k] === '' || query[k] === 1 || query[k] === undefined) delete query[k];
    });
    router.push({ path: '/admin/orders', query });
}

function search() {
    apply({ q: draft.value.trim(), page: 1 });
}

watch(() => route.fullPath, () => {
    status.value = String(route.query.status || '');
    draft.value = String(route.query.q || '');
    load();
});

onMounted(() => {
    draft.value = kw.value;
    load();
});
</script>
