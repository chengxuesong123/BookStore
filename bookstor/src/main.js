import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { useCartStore } from './stores/cart';
import './assets/style.css';
import './assets/v2.css';

const app = createApp(App);
app.use(createPinia());

const auth = useAuthStore();
const cart = useCartStore();

auth.bootstrap()
    .then(() => cart.refresh().catch(() => {}))
    .finally(() => {
        app.use(router);
        app.mount('#app');
    });
