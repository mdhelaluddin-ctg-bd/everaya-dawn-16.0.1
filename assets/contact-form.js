class ContactFormAjax extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.dialog = this.querySelector('.contact-confirm-dialog');
    this.submitButton = this.querySelector('[type="submit"]');
    this.spinner = this.querySelector('.loading__spinner');
    this.errorEl = this.querySelector('.contact__ajax-error');
    this.submitting = false;
    this.allowNativeSubmit = false;

    if (!this.form || !this.dialog || !this.submitButton) return;

    this.onSubmit = this.onSubmit.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onDialogClosed = this.onDialogClosed.bind(this);

    // Capture phase so we beat other submit handlers that would reload the page.
    this.form.addEventListener('submit', this.onSubmit, true);
    this.querySelectorAll('[data-contact-confirm-close]').forEach((el) => {
      el.addEventListener('click', this.closeDialog);
    });
    this.dialog.addEventListener('close', this.onDialogClosed);
  }

  disconnectedCallback() {
    if (this.form) this.form.removeEventListener('submit', this.onSubmit, true);
  }

  onSubmit(event) {
    if (this.allowNativeSubmit) {
      this.allowNativeSubmit = false;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (this.submitting) return;

    if (typeof this.form.reportValidity === 'function' && !this.form.reportValidity()) {
      return;
    }

    this.submitting = true;
    this.clearError();
    this.setLoading(true);

    const runFetch = () => {
      this.submitAjax()
        .catch(() => {
          this.showError('Something went wrong sending your message. Please try again in a moment.');
        })
        .finally(() => {
          this.submitting = false;
          this.setLoading(false);
        });
    };

    // Wait for CAPTCHA token fields, then POST — never call form.submit() here.
    if (window.Shopify && window.Shopify.captcha && typeof window.Shopify.captcha.protect === 'function') {
      window.Shopify.captcha.protect(this.form, runFetch);
      return;
    }

    runFetch();
  }

  getActionUrl() {
    const action = this.form.getAttribute('action') || '/contact';
    // Fragment identifiers must not be part of the request URL.
    return action.split('#')[0];
  }

  /**
   * Native contact forms post as application/x-www-form-urlencoded.
   * fetch(FormData) sends multipart/form-data, which Shopify often rejects with 400.
   */
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

  async submitAjax() {
    const action = this.getActionUrl();
    const body = this.buildUrlEncodedBody();

    const response = await fetch(action, {
      method: 'POST',
      body,
      credentials: 'same-origin',
      // No custom headers — keeps this a "simple" request and matches a normal form POST.
    });

    // Interactive challenge / rate limit — fall back to a real browser submit.
    if (response.status === 429) {
      this.allowNativeSubmit = true;
      this.submitting = false;
      this.setLoading(false);
      HTMLFormElement.prototype.submit.call(this.form);
      return;
    }

    // CAPTCHA / validation rejection — fall back so the customer isn't stuck.
    if (response.status === 400) {
      this.allowNativeSubmit = true;
      this.submitting = false;
      this.setLoading(false);
      HTMLFormElement.prototype.submit.call(this.form);
      return;
    }

    if (!response.ok) {
      throw new Error(`Contact form failed with status ${response.status}`);
    }

    this.form.reset();
    this.openDialog();
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
      this.dialog.showModal();
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
    if (this.submitButton) this.submitButton.focus();
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
