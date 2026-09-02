/*
 * Newsletter popup — timed modal for the `popup-newsletter` section.
 * Remembers dismissal/subscription in localStorage so returning visitors
 * are not nagged, and always opens instantly in the theme editor.
 */
(function () {
  const FOCUSABLE =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function isDesignMode() {
    return Boolean(window.Shopify && window.Shopify.designMode);
  }

  function readSnooze(key) {
    try {
      const until = window.localStorage.getItem(key);
      return until ? Number(until) : 0;
    } catch (e) {
      return 0;
    }
  }

  function writeSnooze(key, days) {
    try {
      if (days <= 0) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, String(Date.now() + days * 86400000));
    } catch (e) {
      /* private browsing — popup simply reappears next visit */
    }
  }

  function consumeSubmission(key) {
    try {
      const submittedAt = Number(window.sessionStorage.getItem(key));
      window.sessionStorage.removeItem(key);
      return submittedAt > 0 && Date.now() - submittedAt < 300000;
    } catch (e) {
      return false;
    }
  }

  function markSubmission(key) {
    try {
      window.sessionStorage.setItem(key, String(Date.now()));
    } catch (e) {
      /* The popup still submits normally when storage is unavailable. */
    }
  }

  function setup(popup) {
    const key = popup.dataset.storageKey;
    const submissionKey = key + '-submitted';
    const days = parseInt(popup.dataset.frequency, 10) || 0;
    const delay = (parseInt(popup.dataset.delay, 10) || 0) * 1000;
    const testMode = popup.dataset.testMode === 'true';
    const allowMobile = popup.dataset.mobile === 'true';
    const posted = popup.querySelector('.form__message[tabindex]') !== null;
    const hasResponse = popup.querySelector('.popup-newsletter__message') !== null;
    const submittedHere = consumeSubmission(submissionKey);
    const form = popup.querySelector('.popup-newsletter__form');
    let lastFocused = null;
    let timer = null;

    if (form) {
      form.addEventListener('submit', function () {
        markSubmission(submissionKey);
      });
    }

    function open() {
      if (popup.classList.contains('popup-newsletter--visible')) return;
      lastFocused = document.activeElement;
      popup.hidden = false;
      // Next frame so the transition has a starting state to animate from.
      requestAnimationFrame(function () {
        popup.classList.add('popup-newsletter--visible');
      });
      document.body.classList.add('overflow-hidden');
      const target = popup.querySelector('input, button');
      if (target && window.matchMedia('(min-width: 750px)').matches) {
        target.focus({ preventScroll: true });
      }
      document.addEventListener('keydown', onKeydown);
    }

    function close(snooze) {
      window.clearTimeout(timer);
      popup.classList.remove('popup-newsletter--visible');
      document.body.classList.remove('overflow-hidden');
      document.removeEventListener('keydown', onKeydown);
      window.setTimeout(function () {
        popup.hidden = true;
      }, 350);
      if (snooze !== false && !testMode) writeSnooze(key, days);
      if (lastFocused) lastFocused.focus({ preventScroll: true });
    }

    // A section re-render swaps this element out mid-open; drop its scroll lock.
    popup.addEventListener('popup:teardown', function () {
      window.clearTimeout(timer);
      document.body.classList.remove('overflow-hidden');
    });

    function onKeydown(event) {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = Array.from(popup.querySelectorAll(FOCUSABLE)).filter(
        function (el) {
          return el.offsetParent !== null;
        }
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    popup.querySelectorAll('[data-popup-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        close();
      });
    });

    // Theme editor: open immediately and never snooze, so the merchant can style it.
    if (isDesignMode()) {
      open();
      return;
    }

    // Shopify reports customer-form success to every newsletter form on the page.
    // Only show this popup's confirmation when this popup initiated the submit.
    if (posted) {
      writeSnooze(key, days);
      if (submittedHere) open();
      return;
    }

    // Reopen this popup to show an error from its own form submission.
    if (submittedHere && hasResponse) {
      open();
      return;
    }

    if (!allowMobile && window.matchMedia('(max-width: 749px)').matches) return;
    if (!testMode && readSnooze(key) > Date.now()) return;

    timer = window.setTimeout(open, delay);
  }

  function init() {
    document.querySelectorAll('.popup-newsletter').forEach(setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:unload', function (event) {
    const popup = event.target.querySelector('.popup-newsletter');
    if (popup) popup.dispatchEvent(new CustomEvent('popup:teardown'));
  });

  document.addEventListener('shopify:section:load', function (event) {
    const popup = event.target.querySelector('.popup-newsletter');
    if (popup) setup(popup);
  });
})();
