import axios from 'axios';

export const http = axios.create({
    baseURL: '/api',
    withCredentials: true,
    timeout: 20000,
});

let csrfToken = '';

export function setCsrfToken(token) {
    csrfToken = token || '';
}

http.interceptors.request.use((config) => {
    const method = (config.method || 'get').toLowerCase();
    if (csrfToken && method !== 'get' && method !== 'head') {
        config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
});

http.interceptors.response.use(
    (res) => res.data,
    (err) => {
        const res = err.response;
        if (!res) {
            return Promise.reject({ status: 0, code: 0, msg: '网络不给力，稍后再试', errors: {} });
        }
        const body = res.data || {};
        return Promise.reject({
            status: res.status,
            code: body.code || 0,
            msg: body.msg || '请求失败',
            errors: (body.data && body.data.errors) || {},
        });
    },
);
