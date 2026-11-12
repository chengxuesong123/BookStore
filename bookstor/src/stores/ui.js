import { defineStore } from 'pinia';

let seq = 0;

export const useUiStore = defineStore('ui', {
    state: () => ({
        toasts: [],
    }),
    actions: {
        toast(msg, type = 'ok') {
            const id = ++seq;
            this.toasts.push({ id, msg, type });
            setTimeout(() => {
                this.toasts = this.toasts.filter((t) => t.id !== id);
            }, 3200);
        },
        dismiss(id) {
            this.toasts = this.toasts.filter((t) => t.id !== id);
        },
    },
});
