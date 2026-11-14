<template>
    <nav v-if="pages > 1" class="pager" aria-label="分页">
        <ul class="pagination">
            <li :class="{ disabled: page <= 1 }">
                <a href="#" @click.prevent="go(page - 1)">上一页</a>
            </li>
            <li v-for="p in windowPages" :key="p" :class="{ active: p === page }">
                <a href="#" @click.prevent="go(p)">{{ p }}</a>
            </li>
            <li :class="{ disabled: page >= pages }">
                <a href="#" @click.prevent="go(page + 1)">下一页</a>
            </li>
        </ul>
        <span class="pager-info">第 {{ page }} / {{ pages }} 页</span>
    </nav>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    page: { type: Number, required: true },
    pages: { type: Number, required: true },
});
const emit = defineEmits(['change']);

// 最多显示 5 个页码：页数 ≤ 5 全显示，否则以当前页为中心取 5 个
const windowPages = computed(() => {
    const total = Math.max(1, props.pages);
    const current = Math.min(Math.max(1, props.page), total);
    if (total <= 5) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const start = Math.min(Math.max(1, current - 2), total - 4);
    return Array.from({ length: 5 }, (_, i) => start + i);
});

function go(p) {
    if (p < 1 || p > props.pages || p === props.page) return;
    emit('change', p);
}
</script>
