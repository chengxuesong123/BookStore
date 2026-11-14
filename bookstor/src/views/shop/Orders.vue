<template>
    <div class="page-head">
        <div>
            <h1>我的订单</h1>
            <div class="sub">共 {{ total }} 单</div>
        </div>
    </div>

    <div v-if="empty" class="empty">
        <div class="empty-ico">📦</div>
        <h3>还没有订单</h3>
        <p>下单后会出现在这里。</p>
        <router-link class="btn btn-primary" to="/books" style="margin-top:14px">去选书</router-link>
    </div>

    <div v-for="o in list" :key="o.id" class="order-card">
        <div class="order-head">
            <span class="no">{{ o.order_no }}</span>
            <span>{{ o.created_at }}</span>
            <span class="spacer"></span>
            <span class="pill" :class="'pill-' + o.status">{{ o.status_text }}</span>
        </div>
        <div class="order-body">
            <div v-for="it in o.items" :key="it.book_id + '-' + it.book_title" class="order-line">
                <div class="thumb" :style="coverStyle(it.cover || it.book_title)"></div>
                <div class="nm">{{ it.book_title }} <small>× {{ it.quantity }}</small></div>
                <div class="price">{{ money(it.line_total) }}</div>
            </div>
        </div>
        <div class="order-foot">
            <div class="total">合计<b>{{ money(o.total_amount) }}</b></div>
            <div class="order-actions">
                <router-link class="btn btn-sm btn-ghost" :to="`/order/${o.id}`">订单详情</router-link>
            </div>
        </div>
    </div>

    <ul v-if="pages > 1" class="pagination pager">
        <li v-for="p in pages" :key="p" :class="{ active: p === page }">
            <a href="#" @click.prevent="go(p)">{{ p }}</a>
        </li>
    </ul>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/client';
import { coverStyle } from '../../utils/cover';

const route = useRoute();
const router = useRouter();
const list = ref([]);
const total = ref(0);
const empty = ref(false);

const page = computed(() => Math.max(1, Number(route.query.page || 1)));
const pages = computed(() => Math.max(1, Math.ceil(total.value / 10)));
const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function load() {
    try {
        const res = await http.get('/orders', { params: { page: page.value } });
        list.value = res.data.list;
        total.value = res.data.total;
        empty.value = res.data.list.length === 0;
    } catch (e) {
        list.value = [];
        empty.value = true;
    }
}

function go(p) {
    router.push({ path: '/orders', query: p > 1 ? { page: p } : {} });
}

onMounted(load);
watch(() => route.fullPath, load);
</script>
