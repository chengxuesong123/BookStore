import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';

const ShopLayout = () => import('../layouts/ShopLayout.vue');
const AdminLayout = () => import('../layouts/AdminLayout.vue');

const routes = [
    {
        path: '/',
        component: ShopLayout,
        children: [
            { path: '', name: 'home', component: () => import('../views/shop/Home.vue') },
            { path: 'books', name: 'books', component: () => import('../views/shop/Books.vue') },
            { path: 'book/:id', name: 'book', component: () => import('../views/shop/BookDetail.vue') },
            { path: 'cart', name: 'cart', component: () => import('../views/shop/Cart.vue') },
            { path: 'checkout', name: 'checkout', component: () => import('../views/shop/Checkout.vue'), meta: { auth: true } },
            { path: 'orders', name: 'orders', component: () => import('../views/shop/Orders.vue'), meta: { auth: true } },
            { path: 'order/:id', name: 'order', component: () => import('../views/shop/OrderDetail.vue'), meta: { auth: true } },
            { path: 'account', name: 'account', component: () => import('../views/shop/Account.vue'), meta: { auth: true } },
        ],
    },
    { path: '/login', name: 'login', component: () => import('../views/shop/Login.vue') },
    { path: '/register', name: 'register', component: () => import('../views/shop/Register.vue') },
    {
        path: '/admin',
        component: AdminLayout,
        meta: { auth: true, admin: true },
        children: [
            { path: '', name: 'admin-home', component: () => import('../views/admin/Dashboard.vue'), meta: { title: '概览' } },
            { path: 'books', name: 'admin-books', component: () => import('../views/admin/Books.vue'), meta: { title: '图书管理' } },
            { path: 'books/new', name: 'admin-book-new', component: () => import('../views/admin/BookForm.vue'), meta: { title: '新增图书' } },
            { path: 'books/:id/edit', name: 'admin-book-edit', component: () => import('../views/admin/BookForm.vue'), meta: { title: '编辑图书' } },
            { path: 'orders', name: 'admin-orders', component: () => import('../views/admin/Orders.vue'), meta: { title: '订单管理' } },
            { path: 'orders/:id', name: 'admin-order', component: () => import('../views/admin/OrderDetail.vue'), meta: { title: '订单详情' } },
            { path: 'users', name: 'admin-users', component: () => import('../views/admin/Users.vue'), meta: { title: '用户管理' } },
            { path: 'categories', name: 'admin-categories', component: () => import('../views/admin/Categories.vue'), meta: { title: '分类管理' } },
            { path: ':pathMatch(.*)*', name: 'admin-404', component: () => import('../views/admin/NotFound.vue'), meta: { title: '页面不存在' } },
        ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/shop/NotFound.vue') },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
    const auth = useAuthStore();
    const ui = useUiStore();

    if (!auth.ready) {
        await auth.bootstrap();
    }

    if (to.meta.auth && !auth.isLogin) {
        return { path: '/login', query: { redirect: to.fullPath } };
    }
    if (to.meta.admin && !auth.isAdmin) {
        ui.toast('当前账号没有后台权限', 'error');
        return { path: '/' };
    }
    if ((to.name === 'login' || to.name === 'register') && auth.isLogin) {
        return { path: '/' };
    }
    return true;
});

export default router;
