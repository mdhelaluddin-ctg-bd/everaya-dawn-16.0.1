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

    // Capture phase so we beat hCaptcha / other submit handlers that would reload the page.
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

    // Ensure CAPTCHA token fields are present, then AJAX — do not call form.submit().
    if (window.Shopify && window.Shopify.captcha && typeof window.Shopify.captcha.protect === 'function') {
      window.Shopify.captcha.protect(this.form, runFetch);
      return;
    }

    runFetch();
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

    // Interactive challenge page required — let the browser submit normally.
    if (response.status === 429) {
      this.allowNativeSubmit = true;
      this.submitting = false;
      this.setLoading(false);
      HTMLFormElement.prototype.submit.call(this.form);
      return;
    }

    if (!response.ok) {
      throw new Error(`Contact form failed with status ${response.status}`);
    }

    // Shopify redirects to ?contact_posted=true on success. That alone is enough.
    // Do not scan page HTML for role="alert" — success pages can include unrelated alerts
    // and Dawn's success banner uses form-status-list, which caused false failures.
    const posted = (response.url || '').includes('contact_posted=true');
    if (!posted && !response.ok) {
      throw new Error('Contact form submission failed');
    }

    this.form.reset();
    this.openDialog();

    if (posted && window.history && window.history.replaceState) {
      try {
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash || '#ContactForm'}`);
      } catch (error) {
        // Ignore history errors.
      }
    }
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
