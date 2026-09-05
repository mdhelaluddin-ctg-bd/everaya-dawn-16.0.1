class ContactFormAjax extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.dialog = this.querySelector('.contact-confirm-dialog');
    this.submitButton = this.querySelector('[type="submit"]');
    this.spinner = this.querySelector('.loading__spinner');
    this.errorEl = this.querySelector('.contact__ajax-error');
    this.allowNativeSubmit = false;

    if (!this.form || !this.dialog || !this.submitButton) return;

    this.onSubmit = this.onSubmit.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onDialogClosed = this.onDialogClosed.bind(this);

    this.form.addEventListener('submit', this.onSubmit);
    this.querySelectorAll('[data-contact-confirm-close]').forEach((el) => {
      el.addEventListener('click', this.closeDialog);
    });
    this.dialog.addEventListener('close', this.onDialogClosed);
  }

  disconnectedCallback() {
    if (this.form) this.form.removeEventListener('submit', this.onSubmit);
  }

  onSubmit(event) {
    if (this.allowNativeSubmit) {
      this.allowNativeSubmit = false;
      return;
    }

    event.preventDefault();

    if (typeof this.form.reportValidity === 'function' && !this.form.reportValidity()) {
      return;
    }

    this.clearError();
    this.setLoading(true);

    const submitRequest = () => {
      this.submitAjax().catch(() => {
        this.setLoading(false);
        this.showError('Something went wrong sending your message. Please try again in a moment.');
      });
    };

    if (window.Shopify && window.Shopify.captcha && typeof window.Shopify.captcha.protect === 'function') {
      window.Shopify.captcha.protect(this.form, submitRequest);
      return;
    }

    submitRequest();
  }

  async submitAjax() {
    const formData = new FormData(this.form);
    const action = this.form.getAttribute('action') || '/contact';

    const response = await fetch(action, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    // Rate-limit / interactive CAPTCHA challenge — use a normal browser submit.
    if (response.status === 429) {
      this.setLoading(false);
      this.allowNativeSubmit = true;
      HTMLFormElement.prototype.submit.call(this.form);
      return;
    }

    if (!response.ok) {
      throw new Error(`Contact form failed with status ${response.status}`);
    }

    const responseUrl = response.url || '';
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (error) {
      responseText = '';
    }

    const redirectedWithSuccess = responseUrl.includes('contact_posted=true');
    const htmlHasFormError =
      responseText.includes('role="alert"') &&
      (responseText.includes('ContactForm-email-error') || responseText.includes('form-status-list'));

    if (!redirectedWithSuccess && htmlHasFormError) {
      throw new Error('Contact form validation failed');
    }

    this.form.reset();
    this.setLoading(false);
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
