<template>
    <div>
        <div class="admin-head">
            <div>
                <h1>{{ isEdit ? '编辑图书' : '新增图书' }}</h1>
                <div class="who">带 <span class="req">*</span> 的为必填；封面由系统按书名自动获取，不用手填</div>
            </div>
            <router-link class="btn btn-ghost btn-sm" to="/admin/books">返回列表</router-link>
        </div>

        <div class="info-card">
            <form id="book-form" novalidate @submit.prevent="save">
                <div class="form-grid">
                    <div class="field" :class="{ 'has-error': errors.title }">
                        <label>书名<span class="req">*</span></label>
                        <input v-model="form.title" name="title" placeholder="例如：活着">
                        <div class="err">{{ errors.title || '书名必填，且不超过 120 字' }}</div>
                    </div>
                    <div class="field" :class="{ 'has-error': errors.category_id }">
                        <label>分类<span class="req">*</span></label>
                        <select v-model="form.category_id" name="category_id" class="select">
                            <option value="">请选择</option>
                            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                        </select>
                        <div class="err">{{ errors.category_id || '请选择有效分类' }}</div>
                    </div>
                    <div class="field">
                        <label>作者</label>
                        <input v-model="form.author" name="author" placeholder="作者">
                    </div>
                    <div class="field">
                        <label>出版社</label>
                        <input v-model="form.publisher" name="publisher" placeholder="出版社">
                    </div>
                    <div class="field" :class="{ 'has-error': errors.price }">
                        <label>现价（元）<span class="req">*</span></label>
                        <input v-model.number="form.price" name="price" type="number" step="0.01" min="0" placeholder="29.00">
                        <div class="err">{{ errors.price || '现价必须大于 0' }}</div>
                    </div>
                    <div class="field">
                        <label>原价（元）</label>
                        <input v-model.number="form.original_price" name="original_price" type="number" step="0.01" min="0" placeholder="39.00">
                    </div>
                    <div class="field" :class="{ 'has-error': errors.stock }">
                        <label>库存<span class="req">*</span></label>
                        <input v-model.number="form.stock" name="stock" type="number" min="0" placeholder="12">
                        <div class="err">{{ errors.stock || '库存不能为负' }}</div>
                    </div>
                    <div class="field">
                        <label>状态</label>
                        <select v-model="form.status" name="status" class="select">
                            <option value="on">在售</option>
                            <option value="off">下架</option>
                        </select>
                    </div>
                </div>

                <div class="field">
                    <label>封面</label>
                    <div class="cover-preview" :style="previewStyle"></div>
                    <p class="muted" style="margin:10px 0 0;font-size:12.5px">
                        不用手填。保存时按书名自动调用 Open Library 封面，找不到再试 Google Books；都失败就用占位色块。
                        <template v-if="isEdit">改了书名会重新获取。</template>
                    </p>
                </div>

                <div class="field">
                    <label>简介</label>
                    <textarea v-model="form.intro" name="intro" rows="4" placeholder="两三句话介绍这本书"></textarea>
                </div>

                <div class="field">
                    <label>标签（逗号分隔）</label>
                    <input v-model="form.tags" name="tags" placeholder="经典,当代文学">
                </div>

                <div class="form-actions">
                    <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : (isEdit ? '保存修改' : '新增图书') }}</button>
                    <router-link class="btn btn-ghost" to="/admin/books">取消</router-link>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/client';
import { coverStyle } from '../../utils/cover';
import { useUiStore } from '../../stores/ui';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const isEdit = computed(() => route.name === 'admin-book-edit');
const categories = ref([]);
const errors = ref({});
const saving = ref(false);

const form = reactive({
    title: '',
    category_id: '',
    author: '',
    publisher: '',
    price: '',
    original_price: '',
    stock: 0,
    status: 'on',
    cover: '',
    intro: '',
    tags: '',
});

const previewStyle = computed(() => coverStyle({ title: form.title || '新书', cover: form.cover }));

async function load() {
    try {
        const res = await http.get('/categories');
        categories.value = res.data.list;
    } catch (e) {
        ui.toast(e.msg, 'error');
    }
    if (!isEdit.value) return;
    try {
        const res = await http.get(`/admin/books/${route.params.id}`);
        Object.assign(form, res.data.book);
        form.category_id = res.data.book.category_id;
    } catch (e) {
        ui.toast(e.msg, 'error');
        router.push('/admin/books');
    }
}

async function save() {
    errors.value = {};
    saving.value = true;
    try {
        const payload = { ...form, category_id: Number(form.category_id) || 0 };
        if (isEdit.value) {
            await http.put(`/admin/books/${route.params.id}`, payload);
            ui.toast('图书已更新');
        } else {
            await http.post('/admin/books', payload);
            ui.toast('图书已新增');
        }
        router.push('/admin/books');
    } catch (e) {
        errors.value = e.errors || {};
        ui.toast(e.msg, 'error');
    } finally {
        saving.value = false;
    }
}

onMounted(load);
</script>
