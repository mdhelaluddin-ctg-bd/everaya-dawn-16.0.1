/**
 * Contact form: loader on Send → confirmation dialog.
 *
 * Shopify spam protection (hCaptcha) injects h-captcha-response only during a real
 * form submit — Shopify.captcha.protect()'s callback fires when the form is *bound*,
 * not when a token exists. So a fetch() POST can never carry a valid token and
 * Shopify answers 400 "Missing CAPTCHA token".
 *
 * Therefore:
 * - Captcha enabled  → let the native submit run, keep the loader on, and open the
 *   dialog when the page comes back with ?contact_posted=true.
 * - Captcha disabled → POST via fetch (urlencoded) and open the dialog, no reload.
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

    this.form.addEventListener('submit', this.onSubmit);
    this.querySelectorAll('[data-contact-confirm-close]').forEach((el) => {
      el.addEventListener('click', this.closeDialog);
    });
    this.dialog.addEventListener('close', this.onDialogClosed);

    // Clear the loader if the customer returns via the back button.
    window.addEventListener('pageshow', () => this.setLoading(false));

    this.openDialogIfPosted();
  }

  disconnectedCallback() {
    if (this.form) this.form.removeEventListener('submit', this.onSubmit);
  }

  get captchaEnabled() {
    return Boolean(window.Shopify && window.Shopify.captcha) && this.form.dataset.shopifyCaptcha === 'true';
  }

  openDialogIfPosted() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('contact_posted') !== 'true') return;

      this.openDialog();

      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', `${window.location.pathname}#ContactForm`);
      }
    } catch (error) {
      // Ignore
    }
  }

  onSubmit(event) {
    if (this.submitting) {
      event.preventDefault();
      return;
    }

    if (typeof this.form.reportValidity === 'function' && !this.form.reportValidity()) {
      event.preventDefault();
      return;
    }

    this.clearError();
    this.submitting = true;

    if (this.captchaEnabled) {
      // Let Shopify's captcha handlers own the submit. Show the loader and keep the
      // button enabled — disabling it here would drop it from the POST.
      this.setLoading(true, { keepEnabled: true });
      return;
    }

    event.preventDefault();
    this.setLoading(true);
    this.postAjax();
  }

  async postAjax() {
    try {
      const response = await fetch(this.getActionUrl(), {
        method: 'POST',
        body: this.buildUrlEncodedBody(),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`Contact form failed with status ${response.status}`);
      }

      this.form.reset();
      this.submitting = false;
      this.setLoading(false);
      this.openDialog();
    } catch (error) {
      this.submitting = false;
      this.setLoading(false);
      this.showError('Something went wrong sending your message. Please try again in a moment.');
    }
  }

  getActionUrl() {
    const action = this.form.getAttribute('action') || '/contact';
    return action.split('#')[0];
  }

  /** Shopify's contact endpoint expects a normal urlencoded POST, not multipart. */
  buildUrlEncodedBody() {
    const params = new URLSearchParams();

    new FormData(this.form).forEach((value, key) => {
      if (typeof value === 'string') params.append(key, value);
    });

    return params;
  }

  setLoading(isLoading, { keepEnabled = false } = {}) {
    this.submitButton.classList.toggle('loading', isLoading);
    this.submitButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');

    if (!keepEnabled) {
      this.submitButton.disabled = isLoading;
    }

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
    this.submitting = false;
    this.setLoading(false);
    this.submitButton.focus();
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
