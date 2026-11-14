/**
 * 封面渲染工具：
 * - 真实图片地址（http/https、/uploads、data:）→ background-image
 * - CSS 渐变字符串 → 直接用作 background
 * - 空封面 → 按书名生成稳定的渐变色，保证任何书都有封面可看
 */

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
    const seed = (book && (book.title || book.id)) || cover || 'book';
    return { background: gradientFor(seed) };
}
