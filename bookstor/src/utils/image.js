/**
 * 头像上传前压缩：最长边 ≤ max，JPEG 质量 0.85。
 * 手机照片 3–5MB 也能传，避免触发服务端大小限制。
 */
export async function compressImage(file, max = 512, quality = 0.85) {
    if (!file || !/^image\//.test(file.type)) return file;
    if (file.type === 'image/gif') return file;

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
    });

    const longest = Math.max(img.width, img.height);
    if (longest <= max && file.size <= 1.5 * 1024 * 1024) return file;

    const scale = Math.min(1, max / longest);
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;

    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}
