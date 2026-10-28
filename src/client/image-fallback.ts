/** 图片加载失败兜底：隐藏加载失败的图片，显示同容器内的 .image-load-fallback 提示，只触发一次。 */
export function initImageFallback(): void {
  document.querySelectorAll<HTMLImageElement>('[data-image-fallback]').forEach(image => {
    image.addEventListener('error', () => {
      image.hidden = true;
      image.parentElement?.querySelector<HTMLElement>('.image-load-fallback')?.removeAttribute('hidden');
    }, { once: true });
  });
}
