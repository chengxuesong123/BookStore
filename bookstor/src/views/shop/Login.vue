<template>
    <div class="auth-wrap">
        <div class="auth-card">
            <h1>欢迎回来</h1>
            <p class="sub">登录后可以下单、查看订单</p>
            <div class="admin-note" :class="{ show: adminMode }">后台入口仅对管理员开放，请使用管理员账号登录。</div>

            <form @submit.prevent="submit">
                <div class="field" :class="{ 'has-error': errors.email }">
                    <label>邮箱<span class="req">*</span></label>
                    <input v-model="form.email" name="email" type="email" placeholder="you@example.com" autocomplete="username">
                    <div class="err">{{ errors.email || '请输入正确的邮箱地址' }}</div>
                </div>
                <div class="field" :class="{ 'has-error': errors.password }">
                    <label>密码<span class="req">*</span></label>
                    <input v-model="form.password" name="password" type="password" placeholder="至少 6 位" autocomplete="current-password">
                    <div class="err">{{ errors.password || '密码至少 6 位' }}</div>
                </div>
                <div class="auth-actions">
                    <span>还没有账号？</span>
                    <router-link :to="{ path: '/register', query: route.query }">去注册</router-link>
                </div>
                <button class="btn btn-primary btn-block" type="submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
            </form>

            <p class="auth-switch">还没有账号？<router-link :to="{ path: '/register', query: route.query }">立即注册</router-link></p>
            <div class="auth-hint"><b>演示账号</b><br>顾客：先注册一个邮箱账号即可登录<br>管理员：<b>admin@moyu.com</b> / <b>admin123</b>（登录后自动进入后台）</div>
            <p style="text-align:center;margin:14px 0 0"><router-link to="/">← 回首页</router-link></p>
        </div>
    </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useCartStore } from '../../stores/cart';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const cart = useCartStore();
const ui = useUiStore();

const form = reactive({ email: '', password: '' });
const errors = ref({});
const loading = ref(false);
const adminMode = computed(() => route.query.admin === '1');

async function submit() {
    errors.value = {};
    loading.value = true;
    try {
        const res = await auth.login(form.email, form.password);
        await cart.refresh().catch(() => {});
        const redirect = String(route.query.redirect || '');
        ui.toast('登录成功');
        router.push(redirect && redirect.startsWith('/') ? redirect : res.redirect);
    } catch (e) {
        errors.value = e.errors || {};
        ui.toast(e.msg, 'error');
    } finally {
        loading.value = false;
    }
}
</script>
