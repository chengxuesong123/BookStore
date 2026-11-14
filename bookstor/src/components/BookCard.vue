<template>
    <router-link :to="`/book/${book.id}`" class="book-card" :class="{ in: shown }">
        <div class="book-cover" :style="coverStyle(book)">
            <span class="cv-cat">{{ book.category_name || '图书' }}</span>
            <div class="cv-title">{{ book.title }}</div>
        </div>
        <div class="book-body">
            <div class="book-title">{{ book.title }}</div>
            <div class="book-author">{{ book.author }}</div>
            <div class="book-foot">
                <span class="price">{{ money(book.price) }}</span>
                <span v-if="book.stock <= 0" class="stock-out">缺货</span>
                <span v-else-if="book.stock <= 3" class="stock-low">仅剩 {{ book.stock }}</span>
                <span v-else class="stock-ok">现货</span>
            </div>
        </div>
    </router-link>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { coverStyle } from '../utils/cover';

const props = defineProps({
    book: { type: Object, required: true },
    delay: { type: Number, default: 0 },
});

const shown = ref(false);
const money = (n) => '¥' + Number(n || 0).toFixed(2);

onMounted(() => {
    setTimeout(() => { shown.value = true; }, 30 + props.delay);
});
</script>
