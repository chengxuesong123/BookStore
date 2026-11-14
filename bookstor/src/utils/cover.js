/**
 * 封面渲染工具：
 * - 真实图片地址 / 本地 SVG 书封 → 封面自带文字，不再叠标题
 * - CSS 渐变 / 空封面占位 → 用 HTML 叠标题
 */

const IS_MOCK = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MOCK === '1';

export function isImageCover(cover) {
    if (typeof cover !== 'string' || cover === '') return false;
    return /^(https?:\/\/|\/uploads\/|data:image\/)/i.test(cover);
}

export function gradientFor(seed) {
    const text = String(seed || 'book');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    const h1 = hash % 360;
    const h2 = (h1 + 38) % 360;
    return `linear-gradient(150deg, hsl(${h1} 42% 38%), hsl(${h2} 46% 24%))`;
}

/**
 * 当前用的哪种封面：image（外链/上传）、local（本地 SVG）、gradient（占位）
 */
export function coverKind(book) {
    const cover = typeof book === 'string' ? book : (book && book.cover) || '';
    if (isImageCover(cover)) return 'image';
    if (cover.includes('gradient')) return 'gradient';
    if (!IS_MOCK && book && typeof book === 'object' && book.id) return 'local';
    return 'gradient';
}

/**
 * 只有渐变占位才需要 HTML 叠标题；图片和本地 SVG 书封自带文字
 */
export function showCoverOverlay(book) {
    return coverKind(book) === 'gradient';
}

export function coverStyle(book) {
    const cover = typeof book === 'string' ? book : (book && book.cover) || '';
    if (isImageCover(cover)) {
        return {
            backgroundImage: `url("${cover}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        };
    }
    if (cover.includes('gradient')) {
        return { background: cover };
    }
    const id = book && typeof book === 'object' ? book.id : 0;
    if (!IS_MOCK && id) {
        return {
            backgroundImage: `url("/api/cover/${id}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        };
    }
    const seed = (book && (book.title || book.id)) || cover || 'book';
    return { background: gradientFor(seed) };
}
