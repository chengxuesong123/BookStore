<template>
    <div v-if="auth.user">
        <div class="page-head">
            <div>
                <h1>用户中心</h1>
                <div class="sub">改头像、改昵称，都在这里</div>
            </div>
            <router-link class="btn btn-ghost btn-sm" to="/orders">我的订单</router-link>
        </div>

        <div class="account-grid">
            <div class="info-card account-card">
                <h3>头像</h3>
                <div class="avatar-picker">
                    <div class="avatar-preview">
                        <img v-if="auth.user.avatar" :src="auth.user.avatar" alt="头像">
                        <span v-else class="avatar-initial big">{{ initial }}</span>
                    </div>
                    <div>
                        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="upload">
                        <button class="btn btn-primary btn-sm" type="button" :disabled="uploading" @click="fileInput.click()">
                            {{ uploading ? '上传中…' : '更换头像' }}
                        </button>
                        <p class="muted" style="margin:10px 0 0;font-size:12.5px">支持 jpg / png / webp，不超过 2MB。</p>
                    </div>
                </div>
            </div>

            <div class="info-card account-card">
                <h3>昵称</h3>
                <form @submit.prevent="saveNickname">
                    <div class="field" :class="{ 'has-error': nicknameError }">
                        <label>昵称<span class="req">*</span></label>
                        <input v-model="nickname" name="nickname" placeholder="2–20 个字">
                        <div class="err">{{ nicknameError || '昵称需要 2–20 个字' }}</div>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-primary btn-sm" type="submit" :disabled="saving">保存昵称</button>
                    </div>
                </form>
            </div>

            <div class="info-card account-card">
                <h3>账号信息</h3>
                <div class="info-grid">
                    <div><div class="k">邮箱</div><div class="v">{{ auth.user.email }}</div></div>
                    <div><div class="k">角色</div><div class="v">{{ auth.user.role === 'admin' ? '管理员' : '顾客' }}</div></div>
                    <div><div class="k">注册时间</div><div class="v">{{ auth.user.created_at }}</div></div>
                </div>
            </div>

            <div class="info-card account-card">
                <h3>快捷入口</h3>
                <div class="account-links">
                    <router-link to="/orders">我的订单</router-link>
                    <router-link to="/cart">购物车</router-link>
                    <router-link v-if="auth.isAdmin" to="/admin">进入后台</router-link>
                    <a href="#" @click.prevent="logout">退出登录</a>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { useCartStore } from '../../stores/cart';
import { useUiStore } from '../../stores/ui';

const auth = useAuthStore();
const cart = useCartStore();
const ui = useUiStore();
const router = useRouter();

const nickname = ref(auth.user?.nickname || '');
const nicknameError = ref('');
const saving = ref(false);
const uploading = ref(false);
const fileInput = ref(null);

const initial = computed(() => (auth.user ? auth.user.nickname.slice(0, 1) : '墨'));

async function saveNickname() {
    nicknameError.value = '';
    saving.value = true;
    try {
        const res = await http.patch('/user/profile', { nickname: nickname.value.trim() });
        auth.setUser(res.data.user);
        ui.toast('昵称已更新');
    } catch (e) {
        nicknameError.value = e.errors?.nickname || e.msg;
    } finally {
        saving.value = false;
    }
}

async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    uploading.value = true;
    try {
        const data = new FormData();
        data.append('avatar', file);
        const res = await http.post('/user/avatar', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        auth.setUser(res.data.user);
        ui.toast('头像已更新');
    } catch (e) {
        ui.toast(e.errors?.avatar || e.msg, 'error');
    } finally {
        uploading.value = false;
        event.target.value = '';
    }
}

async function logout() {
    await auth.logout();
    cart.reset();
    router.push('/');
}
</script>
