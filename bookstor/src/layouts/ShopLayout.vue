<template>
    <div class="page">
        <div class="topbar">
            <div class="wrap topbar-inner">
                <span class="topbar-note">满 59 元包邮 · 48 小时内发货</span>
                <div class="topbar-links">
                    <template v-if="auth.user">
                        <span>你好，{{ auth.user.nickname }}</span>
                        <a href="#" @click.prevent="logout">退出登录</a>
                    </template>
                    <template v-else>
                        <router-link to="/login">登录 / 注册</router-link>
                    </template>
                </div>
            </div>
        </div>

        <header class="site-header" :class="{ scrolled: scrolled }">
            <div class="wrap header-inner">
                <router-link class="logo" to="/">
                    <span class="logo-mark">墨</span>
                    <span class="logo-text">墨屿书屋<small>MOYU BOOKS</small></span>
                </router-link>

                <nav class="main-nav">
                    <router-link to="/" :class="{ active: route.path === '/' }">首页</router-link>
                    <router-link to="/books" :class="{ active: route.path.startsWith('/books') || route.path.startsWith('/book/') }">全部图书</router-link>
                    <router-link to="/orders" :class="{ active: route.path.startsWith('/order') }">我的订单</router-link>
                </nav>

                <div class="header-actions">
                    <button class="icon-btn" type="button" aria-label="搜索" @click="searchOpen = !searchOpen">
                        <IconSearch />
                    </button>
                    <router-link class="icon-btn" to="/cart" aria-label="购物车">
                        <IconCart />
                        <span v-if="cart.count > 0" class="cart-badge show">{{ cart.count > 99 ? '99+' : cart.count }}</span>
                    </router-link>
                    <router-link v-if="auth.user" class="avatar-btn" to="/account" :title="auth.user.nickname">
                        <img v-if="auth.user.avatar" :src="auth.user.avatar" alt="头像">
                        <span v-else class="avatar-initial">{{ initial }}</span>
                    </router-link>
                    <router-link v-else class="btn-login" to="/login">登录</router-link>
                    <router-link v-if="auth.isAdmin" class="admin-chip" to="/admin">后台</router-link>
                </div>

                <form v-if="searchOpen" class="search-overlay" @submit.prevent="submitSearch">
                    <input ref="searchInput" v-model="keyword" type="search" placeholder="搜书名、作者、出版社">
                    <button class="btn btn-primary" type="submit">搜索</button>
                </form>
            </div>
        </header>

        <main class="page-enter">
            <div class="wrap">
                <router-view />
            </div>
        </main>

        <footer class="site-footer">
            <div class="wrap">
                <div class="footer-grid">
                    <div>
                        <div class="footer-logo">墨屿书屋</div>
                        <p class="muted">十八本精选纸书，从文学到技术。慢慢读，别急。</p>
                    </div>
                    <div class="footer-col">
                        <h4>逛一逛</h4>
                        <router-link to="/books">全部图书</router-link>
                        <router-link to="/orders">我的订单</router-link>
                        <router-link to="/cart">购物车</router-link>
                    </div>
                    <div class="footer-col">
                        <h4>服务</h4>
                        <span>满 59 包邮</span>
                        <span>七天退换</span>
                        <span>正品保障</span>
                    </div>
                    <div class="footer-col">
                        <h4>关于</h4>
                        <span>Vue 3 + ThinkPHP 8</span>
                        <span>前后端分离版本</span>
                    </div>
                </div>
                <div class="footer-bottom">
                    <span>© 2026 墨屿书屋 · v2 前后端分离</span>
                </div>
            </div>
        </footer>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import IconSearch from '../components/IconSearch.vue';
import IconCart from '../components/IconCart.vue';
import { useAuthStore } from '../stores/auth';
import { useCartStore } from '../stores/cart';

const auth = useAuthStore();
const cart = useCartStore();
const route = useRoute();
const router = useRouter();

const searchOpen = ref(false);
const keyword = ref('');
const searchInput = ref(null);
const scrolled = ref(false);

const initial = computed(() => (auth.user ? auth.user.nickname.slice(0, 1) : '墨'));

watch(searchOpen, async (open) => {
    if (open) {
        await nextTick();
        searchInput.value?.focus();
    }
});

onMounted(() => {
    window.addEventListener('scroll', () => {
        scrolled.value = window.scrollY > 10;
    }, { passive: true });
});

function submitSearch() {
    const q = keyword.value.trim();
    searchOpen.value = false;
    router.push({ path: '/books', query: q ? { q } : {} });
}

async function logout() {
    await auth.logout();
    cart.reset();
    router.push('/');
}
</script>
