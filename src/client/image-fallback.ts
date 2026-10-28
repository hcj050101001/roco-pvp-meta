/** 图片加载失败兜底：隐藏加载失败的图片，显示同容器内的 .image-load-fallback 提示，只触发一次。 */
export function initImageFallback(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLImageElement>('[data-image-fallback]').forEach((image) => {
    const showFallback = () => {
      image.hidden = true;
      image.closest('picture')?.setAttribute('hidden', '');
      image
        .closest('.card-image')
        ?.querySelector<HTMLElement>('.image-load-fallback')
        ?.removeAttribute('hidden');
    };

    image.addEventListener('error', showFallback, { once: true });

    // The browser does not replay an error event for images that failed before
    // this module ran (common for eager SSR images on a slow/failed request).
    if (image.complete && image.naturalWidth === 0) {
      image.removeEventListener('error', showFallback);
      showFallback();
    }
  });
}
