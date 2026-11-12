<template>
    <div class="page-head">
        <div>
            <h1>确认订单</h1>
            <div class="sub">核对信息后提交</div>
        </div>
        <router-link class="btn btn-ghost btn-sm" to="/cart">返回购物车</router-link>
    </div>

    <div v-if="unavailable" class="empty">
        <div class="empty-ico">📦</div>
        <h3>{{ unavailable }}</h3>
        <router-link class="btn btn-primary" to="/books" style="margin-top:14px">去选书</router-link>
    </div>

    <div v-else-if="preview" class="cart-layout">
        <div class="info-card">
            <div class="form-tip">
                <span>💵</span>
                <div>{{ mode === 'direct' ? '立即购买：只结算这一本，购物车里的东西不会被动。' : '本站不接在线支付，提交后可在订单详情页模拟付款。' }}</div>
            </div>

            <form id="checkout-form" novalidate @submit.prevent="submit">
                <div class="field" :class="{ 'has-error': errors.receiver }">
                    <label>收货人<span class="req">*</span></label>
                    <input v-model="form.receiver" name="receiver" placeholder="请输入收货人姓名">
                    <div class="err">{{ errors.receiver || '请填写收货人姓名（至少 2 个字）' }}</div>
                </div>
                <div class="field" :class="{ 'has-error': errors.phone }">
                    <label>手机号<span class="req">*</span></label>
                    <input v-model="form.phone" name="phone" placeholder="11 位手机号" inputmode="numeric" maxlength="11">
                    <div class="err">{{ errors.phone || '请输入正确的 11 位手机号' }}</div>
                </div>
                <div class="field" :class="{ 'has-error': errors.address }">
                    <label>收货地址<span class="req">*</span></label>
                    <textarea v-model="form.address" name="address" rows="3" placeholder="省 / 市 / 区 + 详细地址"></textarea>
                    <div class="err">{{ errors.address || '地址至少填写 6 个字' }}</div>
                </div>
                <div class="field">
                    <label>订单备注（选填）</label>
                    <input v-model="form.remark" name="remark" placeholder="例如：工作日送货">
                </div>

                <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
                    {{ submitting ? '提交中…' : '提交订单（' + money(preview.totals.total) + '）' }}
                </button>
            </form>
        </div>

        <div class="summary">
            <h3>订单明细</h3>
            <div v-for="line in preview.items" :key="line.book.id" class="sum-row">
                <span>{{ line.book.title }} × {{ line.qty }}</span>
                <b>{{ money(line.line_total) }}</b>
            </div>
            <div class="sum-row"><span>运费</span><b>{{ preview.totals.free ? '免运费' : money(preview.totals.shipping) }}</b></div>
            <div class="sum-total"><span>应付</span><span class="price">{{ money(preview.totals.total) }}</span></div>
            <p class="note">提交后可在「我的订单」查看进度</p>
        </div>
    </div>

    <div v-else class="empty"><div class="empty-ico">…</div><h3>正在核对订单</h3></div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { useCartStore } from '../../stores/cart';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const cart = useCartStore();
const ui = useUiStore();

const preview = ref(null);
const unavailable = ref('');
const errors = ref({});
const submitting = ref(false);

const mode = computed(() => (route.query.mode === 'direct' ? 'direct' : 'cart'));
const bookId = computed(() => Number(route.query.book_id || 0));
const qty = computed(() => Math.max(1, Number(route.query.qty || 1)));

const form = reactive({
    receiver: auth.user ? auth.user.nickname : '',
    phone: '',
    address: '',
    remark: '',
});

const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function load() {
    unavailable.value = '';
    preview.value = null;
    try {
        const url = mode.value === 'direct' ? '/checkout/direct' : '/checkout/cart';
        const res = await http.get(url, { params: mode.value === 'direct' ? { book_id: bookId.value, qty: qty.value } : {} });
        preview.value = res.data;
        if (!form.receiver) form.receiver = auth.user ? auth.user.nickname : '';
    } catch (e) {
        unavailable.value = e.status === 422 ? e.msg : '订单信息加载失败，稍后再试';
    }
}

async function submit() {
    errors.value = {};
    submitting.value = true;
    try {
        const payload = {
            mode: mode.value,
            receiver: form.receiver,
            phone: form.phone,
            address: form.address,
            remark: form.remark,
        };
        if (mode.value === 'direct') {
            payload.book_id = bookId.value;
            payload.qty = qty.value;
        }
        const res = await http.post('/orders', payload);
        await cart.refresh().catch(() => {});
        ui.toast('下单成功，订单号 ' + res.data.order_no);
        router.push(`/order/${res.data.order_id}`);
    } catch (e) {
        errors.value = e.errors || {};
        ui.toast(e.msg, 'error');
    } finally {
        submitting.value = false;
    }
}

onMounted(load);
</script>
