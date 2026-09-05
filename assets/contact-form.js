/**
 * Contact form: loader on Send → confirmation dialog.
 *
 * Shopify contact + hCaptcha:
 * - Body must be application/x-www-form-urlencoded (not multipart FormData).
 * - Strip #ContactForm from the fetch URL.
 * - Call Shopify.captcha.protect() before POST so h-captcha-response is present.
 * - Never HTMLFormElement.prototype.submit() without a captcha token on the form.
 * - After we stopImmediatePropagation, do not rely on requestSubmit() — captcha
 *   bootstrap may preventDefault on unbound forms and leave the UI stuck.
 */
class ContactFormAjax extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.dialog = this.querySelector('.contact-confirm-dialog');
    this.submitButton = this.querySelector('[type="submit"]');
    this.spinner = this.querySelector('.loading__spinner');
    this.errorEl = this.querySelector('.contact__ajax-error');
    this.submitting = false;

    if (!this.form || !this.dialog || !this.submitButton) return;

    this.onSubmit = this.onSubmit.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onDialogClosed = this.onDialogClosed.bind(this);

    this.form.addEventListener('submit', this.onSubmit, true);
    this.querySelectorAll('[data-contact-confirm-close]').forEach((el) => {
      el.addEventListener('click', this.closeDialog);
    });
    this.dialog.addEventListener('close', this.onDialogClosed);

    this.openDialogIfPosted();
  }

  disconnectedCallback() {
    if (this.form) this.form.removeEventListener('submit', this.onSubmit, true);
  }

  openDialogIfPosted() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('contact_posted') !== 'true') return;

      const inlineStatus = this.querySelector('.contact__server-success');
      if (inlineStatus) inlineStatus.hidden = true;

      this.openDialog();

      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', `${window.location.pathname}#ContactForm`);
      }
    } catch (error) {
      // Ignore
    }
  }

  onSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (this.submitting) return;

    if (typeof this.form.reportValidity === 'function' && !this.form.reportValidity()) {
      return;
    }

    this.submitting = true;
    this.clearError();
    this.setLoading(true);

    const start = () => {
      this.attemptSubmit();
    };

    if (window.Shopify && window.Shopify.captcha && typeof window.Shopify.captcha.protect === 'function') {
      try {
        window.Shopify.captcha.protect(this.form, start);
        return;
      } catch (error) {
        // Fall through
      }
    }

    start();
  }

  async attemptSubmit() {
    try {
      const captchaEnabled = Boolean(window.Shopify && window.Shopify.captcha);

      if (captchaEnabled) {
        await this.waitForCaptchaToken(2000);
      }

      const body = this.buildUrlEncodedBody();
      const hasToken = this.hasCaptchaToken(body);

      if (captchaEnabled && !hasToken) {
        this.fail('Could not verify the form. Please refresh the page and try again.');
        return;
      }

      const ok = await this.postAjax(body);
      if (ok) {
        this.form.reset();
        this.submitting = false;
        this.setLoading(false);
        this.openDialog();
        return;
      }

      // AJAX rejected — token is on the form, so a full native POST is safe.
      this.submitWithToken();
    } catch (error) {
      this.fail('Something went wrong sending your message. Please try again in a moment.');
    }
  }

  fail(message) {
    this.submitting = false;
    this.setLoading(false);
    this.showError(message);
  }

  waitForCaptchaToken(timeoutMs) {
    if (this.hasCaptchaToken(this.buildUrlEncodedBody())) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (this.hasCaptchaToken(this.buildUrlEncodedBody()) || Date.now() - started >= timeoutMs) {
          resolve();
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  getActionUrl() {
    const action = this.form.getAttribute('action') || '/contact';
    return action.split('#')[0];
  }

  buildUrlEncodedBody() {
    const params = new URLSearchParams();
    const formData = new FormData(this.form);

    formData.forEach((value, key) => {
      if (typeof value === 'string') {
        params.append(key, value);
      }
    });

    return params;
  }

  hasCaptchaToken(params) {
    const keys = ['h-captcha-response', 'g-recaptcha-response', 'recaptcha-v3-token'];
    return keys.some((key) => {
      const value = params.get(key);
      return typeof value === 'string' && value.trim().length > 0;
    });
  }

  async postAjax(body) {
    const response = await fetch(this.getActionUrl(), {
      method: 'POST',
      body,
      credentials: 'same-origin',
    });

    if (response.status === 400 || response.status === 429) {
      return false;
    }

    if (!response.ok) {
      return false;
    }

    const url = response.url || '';
    if (url.includes('contact_posted=true')) {
      return true;
    }

    let text = '';
    try {
      text = await response.text();
    } catch (error) {
      text = '';
    }

    if (/missing captcha token/i.test(text)) {
      return false;
    }

    return true;
  }

  submitWithToken() {
    // Keep loader on while the browser navigates to ?contact_posted=true.
    this.submitButton.classList.add('loading');
    this.submitButton.setAttribute('aria-busy', 'true');
    if (this.spinner) this.spinner.classList.remove('hidden');

    HTMLFormElement.prototype.submit.call(this.form);
  }

  setLoading(isLoading) {
    this.submitButton.classList.toggle('loading', isLoading);
    this.submitButton.disabled = isLoading;
    this.submitButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');

    if (this.spinner) {
      this.spinner.classList.toggle('hidden', !isLoading);
    }
  }

  openDialog() {
    if (typeof this.dialog.showModal === 'function') {
      if (!this.dialog.open) this.dialog.showModal();
    } else {
      this.dialog.setAttribute('open', '');
    }

    const focusTarget =
      this.dialog.querySelector('.contact-confirm-dialog__ok') ||
      this.dialog.querySelector('[data-contact-confirm-close]');
    if (focusTarget) focusTarget.focus();
  }

  closeDialog(event) {
    if (event) event.preventDefault();

    if (typeof this.dialog.close === 'function') {
      this.dialog.close();
    } else {
      this.dialog.removeAttribute('open');
    }
  }

  onDialogClosed() {
    if (this.submitButton) {
      this.submitButton.disabled = false;
      this.setLoading(false);
      this.submitButton.focus();
    }
  }

  showError(message) {
    if (!this.errorEl) return;
    this.errorEl.hidden = false;
    this.errorEl.textContent = message;
  }

  clearError() {
    if (!this.errorEl) return;
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  }
}

if (!customElements.get('contact-form-ajax')) {
  customElements.define('contact-form-ajax', ContactFormAjax);
}
