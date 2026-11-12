<template>
    <router-link :to="`/book/${book.id}`" class="book-card">
        <div class="book-cover" :style="{ background: book.cover }">
            <span class="bc-cat">{{ book.category_name || '图书' }}</span>
            <div class="bc-text">
                <div class="bc-title">{{ book.title }}</div>
                <div class="bc-author">{{ book.author }}</div>
            </div>
        </div>
        <div class="book-info">
            <div class="book-title">{{ book.title }}</div>
            <div class="book-author">{{ book.author }}</div>
            <div class="book-meta">
                <span class="price">{{ money(book.price) }}</span>
                <span v-if="book.stock <= 0" class="stock-out">缺货</span>
                <span v-else-if="book.stock <= 3" class="stock-low">仅剩 {{ book.stock }}</span>
                <span v-else class="stock-ok">现货</span>
            </div>
        </div>
    </router-link>
</template>

<script setup>
defineProps({ book: { type: Object, required: true } });

const money = (n) => '¥' + Number(n || 0).toFixed(2);
</script>
