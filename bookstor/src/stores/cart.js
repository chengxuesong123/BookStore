import { defineStore } from 'pinia';
import { http } from '../api/client';

export const useCartStore = defineStore('cart', {
    state: () => ({
        items: [],
        totals: { subtotal: 0, shipping: 0, total: 0, count: 0, free: true },
        count: 0,
        loaded: false,
    }),
    actions: {
        apply(data) {
            this.items = data.items || [];
            this.totals = data.totals || { subtotal: 0, shipping: 0, total: 0, count: 0, free: true };
            this.count = data.count || 0;
            this.loaded = true;
        },
        async refresh() {
            const res = await http.get('/cart');
            this.apply(res.data);
        },
        async add(bookId, qty = 1) {
            const res = await http.post('/cart/items', { book_id: bookId, qty });
            this.apply(res.data);
        },
        async setQty(bookId, qty) {
            const res = await http.patch(`/cart/items/${bookId}`, { qty });
            this.apply(res.data);
        },
        async remove(bookId) {
            const res = await http.delete(`/cart/items/${bookId}`);
            this.apply(res.data);
        },
        reset() {
            this.items = [];
            this.totals = { subtotal: 0, shipping: 0, total: 0, count: 0, free: true };
            this.count = 0;
        },
    },
});
