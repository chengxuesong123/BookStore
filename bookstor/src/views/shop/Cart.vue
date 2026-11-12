<template>
    <div class="page-head">
        <div>
            <h1>购物车</h1>
            <div class="sub">共 {{ cart.count }} 件</div>
        </div>
    </div>

    <div v-if="!cart.items.length" class="empty">
        <div class="empty-ico">🛒</div>
        <h3>购物车还是空的</h3>
        <p>去挑几本书吧。</p>
        <router-link class="btn btn-primary" to="/books" style="margin-top:14px">去选书</router-link>
    </div>

    <div v-else class="cart-layout">
        <div class="cart-list">
            <div v-for="line in cart.items" :key="line.book.id" class="cart-row">
                <router-link :to="`/book/${line.book.id}`" class="cart-thumb" :style="{ background: line.book.cover }">
                    {{ line.book.title }}
                </router-link>
                <div>
                    <div class="cart-name"><router-link :to="`/book/${line.book.id}`">{{ line.book.title }}</router-link></div>
                    <div class="cart-author">{{ line.book.author }}</div>
                </div>
                <div class="cart-qty-cell">
                    <div class="qty" style="height:38px">
                        <button type="button" :disabled="line.qty <= 1 || busy" @click="changeQty(line, line.qty - 1)">−</button>
                        <input :value="line.qty" readonly>
                        <button type="button" :disabled="line.qty >= line.book.stock || busy" @click="changeQty(line, line.qty + 1)">+</button>
                    </div>
                </div>
                <div class="cart-sum">{{ money(line.line_total) }}</div>
                <div class="cart-del-cell">
                    <button class="cart-del" type="button" :disabled="busy" @click="remove(line)">删除</button>
                </div>
            </div>
        </div>

        <div class="summary">
            <h3>结算信息</h3>
            <div class="sum-row"><span>商品件数</span><b>{{ cart.count }} 件</b></div>
            <div class="sum-row"><span>商品金额</span><b>{{ money(cart.totals.subtotal) }}</b></div>
            <div class="sum-row"><span>运费</span><b>{{ cart.totals.free ? '免运费' : money(cart.totals.shipping) }}</b></div>
            <div class="sum-total"><span>合计</span><span class="price">{{ money(cart.totals.total) }}</span></div>
            <router-link class="btn btn-primary btn-block" :to="auth.isLogin ? '/checkout' : { path: '/login', query: { redirect: '/checkout' } }">
                {{ auth.isLogin ? '去结算' : '登录后结算' }}
            </router-link>
            <p class="note">满 59 元包邮</p>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useCartStore } from '../../stores/cart';
import { useAuthStore } from '../../stores/auth';
import { useUiStore } from '../../stores/ui';

const cart = useCartStore();
const auth = useAuthStore();
const ui = useUiStore();
const busy = ref(false);

const money = (n) => '¥' + Number(n || 0).toFixed(2);

async function changeQty(line, qty) {
    busy.value = true;
    try {
        await cart.setQty(line.book.id, qty);
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}

async function remove(line) {
    busy.value = true;
    try {
        await cart.remove(line.book.id);
        ui.toast('已移出购物车');
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}
</script>
