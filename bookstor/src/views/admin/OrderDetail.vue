<template>
    <div v-if="order">
        <div class="admin-head">
            <div>
                <h1>订单详情</h1>
                <div class="who">{{ order.order_no }}　<span class="pill" :class="'pill-' + order.status">{{ order.status_text }}</span></div>
            </div>
            <router-link class="btn btn-ghost btn-sm" to="/admin/orders">返回列表</router-link>
        </div>

        <div class="info-card">
            <h3>商品</h3>
            <div v-for="it in order.items" :key="it.book_id + '-' + it.book_title" class="order-line">
                <div class="thumb" :style="{ background: it.cover, width: '56px' }"></div>
                <div class="nm">{{ it.book_title }} <small>{{ money(it.price) }} × {{ it.quantity }}</small></div>
                <div class="price">{{ money(it.line_total) }}</div>
            </div>
            <div class="sum-total" style="margin-top:12px">
                <span>订单金额</span><span class="price">{{ money(order.total_amount) }}</span>
            </div>
        </div>

        <div class="info-card">
            <h3>收货信息</h3>
            <div class="addr-grid">
                <div><div class="k">收货人</div><div class="v">{{ order.receiver }}</div></div>
                <div><div class="k">手机号</div><div class="v">{{ order.phone }}</div></div>
                <div><div class="k">顾客</div><div class="v">{{ order.nickname }}（{{ order.email }}）</div></div>
                <div><div class="k">下单时间</div><div class="v">{{ order.created_at }}</div></div>
                <div><div class="k">来源</div><div class="v">{{ order.source === 'direct' ? '立即购买' : '购物车' }}</div></div>
                <div style="grid-column:1/-1"><div class="k">收货地址</div><div class="v">{{ order.address }}</div></div>
                <div v-if="order.remark" style="grid-column:1/-1"><div class="k">备注</div><div class="v">{{ order.remark }}</div></div>
            </div>
        </div>

        <div class="info-card">
            <h3>操作</h3>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button v-if="order.status === 'paid'" class="btn btn-primary" type="button" :disabled="busy" @click="act('ship')">标记发货</button>
                <button v-if="order.status === 'shipped'" class="btn btn-navy" type="button" :disabled="busy" @click="act('complete')">设为已完成</button>
                <button v-if="['pending','paid'].includes(order.status)" class="btn btn-ghost" type="button" :disabled="busy" @click="cancelOrder">取消订单</button>
                <span v-if="['done','cancelled'].includes(order.status)" class="muted">该订单已结束，无需操作。</span>
            </div>
        </div>
    </div>

    <div v-else-if="error" class="empty"><div class="empty-ico">📦</div><h3>{{ error }}</h3></div>
    <div v-else class="empty"><div class="empty-ico">…</div><h3>正在取订单</h3></div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/client';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const order = ref(null);
const error = ref('');
const busy = ref(false);
const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function load() {
    error.value = '';
    try {
        const res = await http.get(`/admin/orders/${route.params.id}`);
        order.value = res.data.order;
    } catch (e) {
        error.value = e.status === 404 ? '订单不存在' : '加载失败，稍后再试';
    }
}

async function act(name) {
    busy.value = true;
    try {
        const res = await http.post(`/admin/orders/${order.value.id}/${name}`);
        ui.toast(res.msg);
        await load();
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}

async function cancelOrder() {
    if (!window.confirm('取消这笔订单？库存会回补。')) return;
    await act('cancel');
}

onMounted(load);
</script>
