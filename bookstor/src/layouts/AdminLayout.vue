<template>
    <div class="admin-app">
        <aside class="admin-side">
            <router-link class="admin-brand" to="/admin">
                <span class="logo-mark">墨</span>
                <span>墨屿书屋<small>后台</small></span>
            </router-link>

            <nav class="admin-nav">
                <router-link to="/admin" exact-active-class="on">概览</router-link>
                <router-link to="/admin/books" active-class="on">图书管理</router-link>
                <router-link to="/admin/orders" active-class="on">订单管理</router-link>
                <router-link to="/admin/users" active-class="on">用户管理</router-link>
                <router-link to="/admin/categories" active-class="on">分类管理</router-link>
            </nav>

            <div class="admin-side-foot">
                <router-link to="/">返回前台</router-link>
                <a href="#" @click.prevent="logout">退出登录</a>
            </div>
        </aside>

        <div class="admin-main">
            <div class="admin-top">
                <div class="crumb">
                    <router-link to="/admin">后台</router-link>
                    <span v-if="route.meta.title && route.name !== 'admin-home'"> / {{ route.meta.title }}</span>
                </div>
                <div class="admin-user">
                    <span v-if="auth.user">{{ auth.user.nickname }}</span>
                    <router-link to="/account" class="avatar-btn small">
                        <img v-if="auth.user && auth.user.avatar" :key="auth.user.avatar" :src="auth.user.avatar" alt="头像">
                        <span v-else class="avatar-initial">{{ initial }}</span>
                    </router-link>
                </div>
            </div>
            <div class="admin-body">
                <router-view />
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useCartStore } from '../stores/cart';

const auth = useAuthStore();
const cart = useCartStore();
const route = useRoute();
const router = useRouter();

const initial = computed(() => (auth.user ? auth.user.nickname.slice(0, 1) : '墨'));

async function logout() {
    await auth.logout();
    cart.reset();
    router.push('/');
}
</script>
