<template>
    <div v-if="order">
        <div class="page-head">
            <div>
                <h1>订单详情</h1>
                <div class="sub">{{ order.order_no }}</div>
            </div>
            <router-link class="btn btn-ghost btn-sm" to="/orders">返回我的订单</router-link>
        </div>

        <div class="detail-card">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <span class="pill" :class="'pill-' + order.status">{{ order.status_text }}</span>
                <span class="muted" style="font-size:13px">下单时间 {{ order.created_at }}</span>
                <span v-if="order.source === 'direct'" class="pill pill-done">立即购买</span>
            </div>

            <div v-if="order.status === 'cancelled'" class="form-tip" style="margin-top:16px">
                <span>✕</span><div>该订单已取消，库存已回补。</div>
            </div>
            <div v-else class="timeline">
                <template v-for="(s, i) in steps" :key="s.key">
                    <div class="tl-step" :class="{ done: i <= stepIndex }"><span class="dot"></span>{{ s.text }}</div>
                    <div v-if="i < steps.length - 1" class="tl-line" :class="{ done: i < stepIndex }"></div>
                </template>
            </div>

            <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
                <template v-if="order.status === 'pending'">
                    <button class="btn btn-primary" type="button" :disabled="busy" @click="act('pay')">模拟付款</button>
                    <button class="btn btn-ghost" type="button" :disabled="busy" @click="cancelOrder">取消订单</button>
                </template>
                <span v-else-if="order.status === 'paid'" class="muted" style="font-size:13px">已付款，等待商家发货。</span>
                <button v-else-if="order.status === 'shipped'" class="btn btn-navy" type="button" :disabled="busy" @click="act('receive')">确认收货</button>
                <span v-else-if="order.status === 'done'" class="muted" style="font-size:13px">交易已完成，感谢购买。</span>
            </div>
        </div>

        <div class="detail-card">
            <h3>商品</h3>
            <div v-for="it in order.items" :key="it.book_id + '-' + it.book_title" class="order-line">
                <div class="thumb" :style="{ ...coverStyle(it.cover || it.book_title), width: '56px' }"></div>
                <div class="nm">{{ it.book_title }} <small>{{ money(it.price) }} × {{ it.quantity }}</small></div>
                <div class="price">{{ money(it.line_total) }}</div>
            </div>
            <div class="sum-total" style="margin-top:12px">
                <span>商品合计</span><span class="price">{{ money(order.total_amount) }}</span>
            </div>
        </div>

        <div class="detail-card">
            <h3>收货信息</h3>
            <div class="addr-grid">
                <div><div class="k">收货人</div><div class="v">{{ order.receiver }}</div></div>
                <div><div class="k">手机号</div><div class="v">{{ order.phone }}</div></div>
                <div style="grid-column:1/-1"><div class="k">收货地址</div><div class="v">{{ order.address }}</div></div>
                <div v-if="order.remark" style="grid-column:1/-1"><div class="k">备注</div><div class="v">{{ order.remark }}</div></div>
            </div>
        </div>

        <div class="detail-card">
            <h3>支付方式</h3>
            <p class="muted" style="margin:0">模拟支付（无真实交易）。订单流转：待付款 → 待发货 → 已发货 → 已完成。</p>
        </div>
    </div>

    <div v-else-if="error" class="empty">
        <div class="empty-ico">📦</div>
        <h3>{{ error }}</h3>
        <router-link class="btn btn-primary" to="/orders" style="margin-top:14px">回我的订单</router-link>
    </div>
    <div v-else class="empty"><div class="empty-ico">…</div><h3>正在取订单</h3></div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/client';
import { coverStyle } from '../../utils/cover';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const order = ref(null);
const error = ref('');
const busy = ref(false);

const steps = [
    { key: 'pending', text: '待付款' },
    { key: 'paid', text: '待发货' },
    { key: 'shipped', text: '已发货' },
    { key: 'done', text: '已完成' },
];

const stepIndex = computed(() => steps.findIndex((s) => s.key === order.value?.status));
const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function load() {
    error.value = '';
    try {
        const res = await http.get(`/orders/${route.params.id}`);
        order.value = res.data.order;
    } catch (e) {
        error.value = e.status === 404 ? '订单不存在' : '加载失败，稍后再试';
    }
}

async function act(name) {
    busy.value = true;
    try {
        const res = await http.post(`/orders/${order.value.id}/${name}`);
        order.value = res.data.order;
        ui.toast(res.msg);
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}

async function cancelOrder() {
    if (!window.confirm('确定取消这笔订单？库存会回补。')) return;
    await act('cancel');
}

onMounted(load);
</script>
