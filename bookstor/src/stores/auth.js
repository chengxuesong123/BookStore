import { defineStore } from 'pinia';
import { http, setCsrfToken } from '../api/client';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null,
        ready: false,
    }),
    getters: {
        isLogin: (state) => state.user !== null,
        isAdmin: (state) => state.user !== null && state.user.role === 'admin',
    },
    actions: {
        async bootstrap() {
            try {
                const res = await http.get('/auth/csrf');
                setCsrfToken(res.data.token);
            } catch (e) {
                setCsrfToken('');
            }
            try {
                const res = await http.get('/auth/me');
                this.user = res.data.user;
            } catch (e) {
                this.user = null;
            }
            this.ready = true;
        },
        async login(email, password) {
            const res = await http.post('/auth/login', { email, password });
            this.user = res.data.user;
            return res.data;
        },
        async register(payload) {
            const res = await http.post('/auth/register', payload);
            this.user = res.data.user;
            return res.data;
        },
        async logout() {
            try {
                await http.post('/auth/logout');
            } finally {
                this.user = null;
            }
        },
        setUser(user) {
            this.user = user;
        },
    },
});
