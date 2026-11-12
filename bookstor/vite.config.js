import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 开发期把 /api 与 /uploads 代理到 TP8，两端同源，Cookie/CSRF 都不用特殊处理
export default defineConfig({
    plugins: [vue()],
    server: {
        host: '127.0.0.1',
        port: 5173,
        proxy: {
            '/api': { target: 'http://127.0.0.1:8124', changeOrigin: false },
            '/uploads': { target: 'http://127.0.0.1:8124', changeOrigin: false },
        },
    },
});
