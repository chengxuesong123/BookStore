<template>
    <div>
        <div class="admin-head">
            <div>
                <h1>用户管理</h1>
                <div class="who">共 {{ total }} 个账号，可改昵称、角色、重置密码</div>
            </div>
        </div>

        <div class="toolbar">
            <form class="search-box" @submit.prevent="search">
                <input v-model="draft" type="search" placeholder="按邮箱或昵称搜索">
                <button class="btn btn-primary" type="submit">搜索</button>
            </form>
        </div>

        <div v-if="editing" class="info-card">
            <h3>编辑用户 #{{ editing.id }}</h3>
            <form class="form-grid" style="align-items:end" @submit.prevent="save">
                <div class="field">
                    <label>昵称</label>
                    <input v-model="editing.nickname" name="nickname">
                </div>
                <div class="field">
                    <label>角色</label>
                    <select v-model="editing.role" class="select">
                        <option value="customer">顾客</option>
                        <option value="admin">管理员</option>
                    </select>
                </div>
                <div class="field">
                    <label>重置密码（留空不改）</label>
                    <input v-model="editing.password" type="text" placeholder="至少 6 位">
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit" :disabled="busy">保存</button>
                    <button class="btn btn-ghost" type="button" @click="editing = null">取消</button>
                </div>
            </form>
            <p class="muted" style="margin:10px 0 0;font-size:12.5px">
                不能修改自己的角色；系统至少保留一个管理员。改角色后对方需要重新登录才会生效。
            </p>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                <tr><th>ID</th><th>头像</th><th>邮箱</th><th>昵称</th><th>角色</th><th>订单</th><th>注册时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                <tr v-for="u in list" :key="u.id">
                    <td>{{ u.id }}</td>
                    <td>
                        <span class="avatar-btn small">
                            <img v-if="u.avatar" :src="u.avatar" alt="头像">
                            <span v-else class="avatar-initial">{{ (u.nickname || '?').slice(0, 1) }}</span>
                        </span>
                    </td>
                    <td>{{ u.email }}</td>
                    <td>{{ u.nickname }}</td>
                    <td>
                        <span class="pill" :class="u.role === 'admin' ? 'pill-done' : 'pill-cancelled'">
                            {{ u.role === 'admin' ? '管理员' : '顾客' }}
                        </span>
                    </td>
                    <td>{{ u.order_count }}</td>
                    <td>{{ u.created_at }}</td>
                    <td><button class="btn btn-sm btn-ghost" type="button" @click="edit(u)">编辑</button></td>
                </tr>
                <tr v-if="!list.length"><td colspan="8" class="muted" style="text-align:center;padding:30px">没有用户</td></tr>
                </tbody>
            </table>
        </div>

        <Pager :page="page" :pages="pages" @change="go" />
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/client';
import Pager from '../../components/Pager.vue';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const list = ref([]);
const total = ref(0);
const draft = ref('');
const editing = ref(null);
const busy = ref(false);

const kw = computed(() => String(route.query.q || ''));
const page = computed(() => Math.max(1, Number(route.query.page || 1)));
const pages = computed(() => Math.max(1, Math.ceil(total.value / 15)));

async function load() {
    try {
        const res = await http.get('/admin/users', { params: { q: kw.value, page: page.value } });
        list.value = res.data.list;
        total.value = res.data.total;
    } catch (e) {
        ui.toast(e.msg, 'error');
    }
}

function search() {
    const q = draft.value.trim();
    router.push({ path: '/admin/users', query: q ? { q } : {} });
}

function go(p) {
    router.push({ path: '/admin/users', query: { ...(kw.value ? { q: kw.value } : {}), ...(p > 1 ? { page: p } : {}) } });
}

function edit(u) {
    editing.value = { id: u.id, nickname: u.nickname, role: u.role, password: '' };
}

async function save() {
    busy.value = true;
    try {
        const payload = { nickname: editing.value.nickname, role: editing.value.role };
        if (editing.value.password) payload.password = editing.value.password;
        const res = await http.put(`/admin/users/${editing.value.id}`, payload);
        ui.toast(res.msg);
        editing.value = null;
        await load();
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}

watch(() => route.fullPath, () => {
    draft.value = kw.value;
    load();
});

onMounted(() => {
    draft.value = kw.value;
    load();
});
</script>
