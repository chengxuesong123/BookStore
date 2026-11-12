<template>
    <div>
        <div class="admin-head">
            <div>
                <h1>分类管理</h1>
                <div class="who">共 {{ list.length }} 个分类，排序数字越小越靠前</div>
            </div>
        </div>

        <div class="info-card">
            <h3>新增分类</h3>
            <form class="form-grid" style="align-items:end" @submit.prevent="create">
                <div class="field">
                    <label>分类名<span class="req">*</span></label>
                    <input v-model="draft.name" name="name" placeholder="例如：科幻">
                </div>
                <div class="field">
                    <label>排序</label>
                    <input v-model.number="draft.sort" name="sort" type="number" value="0">
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" type="submit" :disabled="busy">新增</button>
                </div>
            </form>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                <tr><th>ID</th><th>分类名</th><th>排序</th><th>图书数</th><th>操作</th></tr>
                </thead>
                <tbody>
                <tr v-for="c in list" :key="c.id">
                    <td>{{ c.id }}</td>
                    <td>
                        <div style="display:flex;gap:8px">
                            <input v-model="c.name" style="max-width:160px">
                            <input v-model.number="c.sort" type="number" style="max-width:70px">
                            <button class="btn btn-sm btn-ghost" type="button" :disabled="busy" @click="update(c)">保存</button>
                        </div>
                    </td>
                    <td>{{ c.sort }}</td>
                    <td>{{ c.book_count }}</td>
                    <td><button class="btn btn-sm btn-ghost" type="button" :disabled="busy" @click="remove(c)">删除</button></td>
                </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { http } from '../../api/client';
import { useUiStore } from '../../stores/ui';

const ui = useUiStore();
const list = ref([]);
const draft = reactive({ name: '', sort: 0 });
const busy = ref(false);

async function load() {
    try {
        const res = await http.get('/admin/categories');
        list.value = res.data.list;
    } catch (e) {
        ui.toast(e.msg, 'error');
    }
}

async function create() {
    busy.value = true;
    try {
        await http.post('/admin/categories', { name: draft.name.trim(), sort: draft.sort });
        draft.name = '';
        ui.toast('分类已新增');
        await load();
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}

async function update(c) {
    busy.value = true;
    try {
        await http.put(`/admin/categories/${c.id}`, { name: c.name.trim(), sort: c.sort });
        ui.toast('分类已更新');
        await load();
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}

async function remove(c) {
    if (!window.confirm(`删除分类「${c.name}」？分类下有书时会被拒绝。`)) return;
    busy.value = true;
    try {
        await http.delete(`/admin/categories/${c.id}`);
        ui.toast('已删除');
        await load();
    } catch (e) {
        ui.toast(e.msg, 'error');
    } finally {
        busy.value = false;
    }
}

onMounted(load);
</script>
