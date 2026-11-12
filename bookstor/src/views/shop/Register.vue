<template>
    <div class="auth-wrap">
        <div class="auth-card">
            <h1>创建账号</h1>
            <p class="sub">用邮箱注册，注册后自动登录</p>

            <form @submit.prevent="submit">
                <div class="field" :class="{ 'has-error': errors.email }">
                    <label>邮箱<span class="req">*</span></label>
                    <input v-model="form.email" name="email" type="email" placeholder="you@example.com" autocomplete="username">
                    <div class="err">{{ errors.email || '请输入正确的邮箱地址' }}</div>
                </div>
                <div class="field" :class="{ 'has-error': errors.nickname }">
                    <label>昵称<span class="req">*</span></label>
                    <input v-model="form.nickname" name="nickname" placeholder="怎么称呼你">
                    <div class="err">{{ errors.nickname || '昵称至少 2 个字' }}</div>
                </div>
                <div class="field" :class="{ 'has-error': errors.password }">
                    <label>密码<span class="req">*</span></label>
                    <input v-model="form.password" name="password" type="password" placeholder="至少 6 位" autocomplete="new-password">
                    <div class="err">{{ errors.password || '密码至少 6 位' }}</div>
                </div>
                <div class="field" :class="{ 'has-error': errors.confirm }">
                    <label>确认密码<span class="req">*</span></label>
                    <input v-model="form.confirm" name="confirm" type="password" placeholder="再输入一次" autocomplete="new-password">
                    <div class="err">{{ errors.confirm || '两次输入的密码不一致' }}</div>
                </div>
                <button class="btn btn-primary btn-block" type="submit" :disabled="loading">{{ loading ? '注册中…' : '注册并登录' }}</button>
            </form>

            <p class="auth-switch">已经有账号了？<router-link :to="{ path: '/login', query: route.query }">去登录</router-link></p>
            <p style="text-align:center;margin:14px 0 0"><router-link to="/">← 回首页</router-link></p>
        </div>
    </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useCartStore } from '../../stores/cart';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const cart = useCartStore();
const ui = useUiStore();

const form = reactive({ email: '', nickname: '', password: '', confirm: '' });
const errors = ref({});
const loading = ref(false);

async function submit() {
    errors.value = {};
    loading.value = true;
    try {
        await auth.register({ ...form });
        await cart.refresh().catch(() => {});
        const redirect = String(route.query.redirect || '');
        ui.toast('注册成功，已自动登录');
        router.push(redirect && redirect.startsWith('/') ? redirect : '/');
    } catch (e) {
        errors.value = e.errors || {};
        ui.toast(e.msg, 'error');
    } finally {
        loading.value = false;
    }
}
</script>
