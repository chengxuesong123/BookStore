<template>
    <div>
        <div class="admin-head">
            <div>
                <h1>概览</h1>
                <div class="who">当前管理员：{{ auth.user?.nickname }}（{{ auth.user?.email }}）</div>
            </div>
            <div style="display:flex;gap:10px">
                <router-link class="btn btn-ghost btn-sm" to="/">返回前台</router-link>
                <router-link class="btn btn-primary btn-sm" to="/admin/books/new">+ 新增图书</router-link>
            </div>
        </div>

        <div class="stat-grid">
            <div class="stat-card"><div class="k">图书总数</div><div class="v">{{ stats.book_total }}</div></div>
            <div class="stat-card"><div class="k">在售图书</div><div class="v">{{ stats.book_on }}</div></div>
            <div class="stat-card"><div class="k">订单总数</div><div class="v">{{ stats.order_total }}</div></div>
            <div class="stat-card accent"><div class="k">待发货</div><div class="v">{{ stats.order_paid }}</div></div>
        </div>

        <div class="info-card">
            <h3>快速入口</h3>
            <div class="account-links">
                <router-link to="/admin/books">图书管理</router-link>
                <router-link to="/admin/orders?status=paid">待发货订单</router-link>
                <router-link to="/admin/users">用户管理</router-link>
                <router-link to="/admin/categories">分类管理</router-link>
            </div>
            <p class="muted" style="margin:10px 0 0">侧边栏一直都在，点哪里都不会把后台弄丢。</p>
        </div>
    </div>
</template>

<script setup>
import { onMounted, reactive } from 'vue';
import { http } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { useUiStore } from '../../stores/ui';

const auth = useAuthStore();
const ui = useUiStore();
const stats = reactive({ book_total: 0, book_on: 0, order_total: 0, order_paid: 0 });

onMounted(async () => {
    try {
        const res = await http.get('/admin/stats');
        Object.assign(stats, res.data);
    } catch (e) {
        ui.toast(e.msg, 'error');
    }
});
</script>
