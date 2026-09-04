/*
 * Smooths the product image swap on variant change.
 *
 * Two things make it flash by default:
 *  - the gallery hides inactive media with `display: none`, which cannot be
 *    transitioned, so the swap is an instant cut;
 *  - `updateMedia()` moves <li> nodes out of a DOMParser document into the live
 *    gallery, so the incoming <img> has never been fetched - revealing it leaves
 *    a blank gap until the browser paints it.
 *
 * So: dim the media list the moment an option is clicked, and only restore it
 * once the newly active image has actually decoded. Nothing here patches Dawn -
 * it rides the events Dawn already publishes.
 */
(() => {
  if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;

  const LOADING_CLASS = 'is-variant-loading';
  // Never let a hung request leave the gallery dimmed.
  const SAFETY_TIMEOUT = 600;

  const pending = new WeakMap();

  const galleryFor = (node) => node?.closest?.('product-info')?.querySelector('.product__media-list');

  const restore = (list) => {
    if (!list) return;
    clearTimeout(pending.get(list));
    pending.delete(list);
    list.classList.remove(LOADING_CLASS);
  };

  const dim = (list) => {
    if (!list) return;
    // An overlapping change restarts the timer rather than stacking timeouts.
    clearTimeout(pending.get(list));
    list.classList.add(LOADING_CLASS);
    pending.set(list, setTimeout(() => restore(list), SAFETY_TIMEOUT));
  };

  subscribe(PUB_SUB_EVENTS.optionValueSelectionChange, ({ data }) => {
    dim(galleryFor(data?.event?.target));
  });

  subscribe(PUB_SUB_EVENTS.variantChange, async ({ data }) => {
    const info = Array.from(document.querySelectorAll('product-info')).find(
      (el) => (el.dataset.originalSection || el.dataset.section) === data?.sectionId
    );
    const list = info?.querySelector('.product__media-list');
    if (!list) return;

    const img = list.querySelector('.product__media-item.is-active img') || list.querySelector('img');

    // Videos and 3D models have no <img> to await - just restore.
    if (!img) {
      restore(list);
      return;
    }

    try {
      // Resolves immediately when cached; waits for paint when it is fresh.
      await img.decode();
    } catch (e) {
      // decode() rejects on a broken or mid-swap image. Restoring anyway is
      // always better than leaving the gallery stuck dimmed.
    }

    restore(list);
  });
})();
