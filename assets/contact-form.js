class ContactFormAjax extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.dialog = this.querySelector('.contact-confirm-dialog');
    this.submitButton = this.querySelector('[type="submit"]');
    this.spinner = this.querySelector('.loading__spinner');
    this.errorEl = this.querySelector('.contact__ajax-error');

    if (!this.form || !this.dialog || !this.submitButton) return;

    this.onSubmit = this.onSubmit.bind(this);
    this.onDialogClose = this.onDialogClose.bind(this);

    this.form.addEventListener('submit', this.onSubmit);
    this.querySelectorAll('[data-contact-confirm-close]').forEach((el) => {
      el.addEventListener('click', this.onDialogClose);
    });
    this.dialog.addEventListener('cancel', this.onDialogClose);
  }

  disconnectedCallback() {
    if (this.form) this.form.removeEventListener('submit', this.onSubmit);
  }

  async onSubmit(event) {
    event.preventDefault();

    if (typeof this.form.reportValidity === 'function' && !this.form.reportValidity()) {
      return;
    }

    this.clearError();
    this.setLoading(true);

    try {
      const formData = new FormData(this.form);
      const action = this.form.getAttribute('action') || window.location.pathname;
      const response = await fetch(action, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const redirectedWithSuccess =
        typeof response.url === 'string' && response.url.includes('contact_posted=true');
      const success = response.ok || redirectedWithSuccess || response.status === 302;

      if (!success) {
        throw new Error('Contact form submission failed');
      }

      this.form.reset();
      this.setLoading(false);
      this.openDialog();
    } catch (error) {
      this.setLoading(false);
      this.showError('Something went wrong sending your message. Please try again in a moment.');
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

  onDialogClose(event) {
    if (event) event.preventDefault();

    if (typeof this.dialog.close === 'function' && this.dialog.open) {
      this.dialog.close();
    } else {
      this.dialog.removeAttribute('open');
    }

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

customElements.define('contact-form-ajax', ContactFormAjax);
