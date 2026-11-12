import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { http } from './api/client';
import { useAuthStore } from './stores/auth';
import { useCartStore } from './stores/cart';
import { installMock } from './mock';
import './assets/style.css';
import './assets/v2.css';

const app = createApp(App);
app.use(createPinia());

// Demo 模式：没有后端，用模拟数据
if (import.meta.env.VITE_MOCK === '1') {
    installMock(http);
}

const auth = useAuthStore();
const cart = useCartStore();

auth.bootstrap()
    .then(() => cart.refresh().catch(() => {}))
    .finally(() => {
        app.use(router);
        app.mount('#app');
    });
