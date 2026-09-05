/**
 * Contact form: submit loader + confirmation dialog.
 *
 * Progressive enhancement over a native form POST, which is what Shopify's own
 * themes do. Shopify's spam protection injects `h-captcha-response` only during a
 * real submit — `Shopify.captcha.protect()` merely wires the form up — so a
 * fetch() POST can never carry a token and is rejected with "Missing CAPTCHA token".
 * https://shopify.dev/docs/storefronts/themes/trust-security/captcha
 *
 * Flow: Send → loader → native POST → back on ?contact_posted=true → dialog.
 *
 * `form.posted_successfully?` is page-global in Liquid, so it also fires for the
 * footer newsletter form. `contact_posted` is specific to this form, so the inline
 * banner stays hidden unless the dialog can't be opened.
 */
const CONTACT_SUBMIT_TIMEOUT = 15000;

class ContactFormConfirmation extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.dialog = this.querySelector('.contact-confirm-dialog');
    this.submitButton = this.querySelector('[type="submit"]');
    this.spinner = this.querySelector('.loading__spinner');
    this.serverSuccess = this.querySelector('.contact__server-success');
    this.submitting = false;

    if (!this.form || !this.dialog || !this.submitButton) return;

    this.onSubmit = this.onSubmit.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onDialogClosed = this.onDialogClosed.bind(this);
    this.onBackdropClick = this.onBackdropClick.bind(this);
    this.reset = this.reset.bind(this);

    this.form.addEventListener('submit', this.onSubmit);
    this.querySelectorAll('[data-contact-confirm-close]').forEach((el) => {
      el.addEventListener('click', this.closeDialog);
    });
    this.dialog.addEventListener('close', this.onDialogClosed);
    this.dialog.addEventListener('click', this.onBackdropClick);

    // Restore the button if the customer returns via the back/forward cache.
    window.addEventListener('pageshow', this.reset);

    this.showConfirmation();
  }

  disconnectedCallback() {
    if (!this.form) return;

    this.form.removeEventListener('submit', this.onSubmit);
    window.removeEventListener('pageshow', this.reset);
    window.clearTimeout(this.timeout);
  }

  get posted() {
    try {
      return new URLSearchParams(window.location.search).get('contact_posted') === 'true';
    } catch (error) {
      return false;
    }
  }

  showConfirmation() {
    // The banner is only rendered when Shopify reports a successful post, and
    // `contact_posted` confirms it was this form rather than the footer newsletter.
    // Both are required, so a shared ?contact_posted=true URL can't fake it.
    if (!this.serverSuccess || !this.posted) return;

    // Reveal the inline banner only if the dialog is unavailable, so the customer
    // always gets confirmation of some kind.
    if (!this.openDialog()) {
      this.serverSuccess.hidden = false;
      this.serverSuccess.focus();
    }

    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', `${window.location.pathname}#ContactForm`);
    }
  }

  onSubmit(event) {
    // Shopify's CAPTCHA handlers own the submit itself; only reflect its state here.
    if (this.submitting) {
      event.preventDefault();
      return;
    }

    this.submitting = true;
    this.setLoading(true);

    // The submit button has no name, so disabling it doesn't alter the payload.
    // Deferred so it can't interfere with the submit currently being dispatched.
    window.setTimeout(() => {
      if (this.submitting) this.submitButton.disabled = true;
    }, 0);

    // If a visible CAPTCHA challenge appears and the customer dismisses it, the
    // page never navigates — don't leave the button spinning forever.
    this.timeout = window.setTimeout(this.reset, CONTACT_SUBMIT_TIMEOUT);
  }

  reset() {
    window.clearTimeout(this.timeout);
    this.submitting = false;
    this.setLoading(false);
  }

  setLoading(isLoading) {
    this.submitButton.classList.toggle('loading', isLoading);
    this.submitButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');

    if (!isLoading) this.submitButton.disabled = false;
    if (this.spinner) this.spinner.classList.toggle('hidden', !isLoading);
  }

  /** @returns {boolean} whether the modal was opened. */
  openDialog() {
    try {
      if (typeof this.dialog.showModal !== 'function') return false;
      if (!this.dialog.open) this.dialog.showModal();
    } catch (error) {
      return false;
    }

    const focusTarget =
      this.dialog.querySelector('.contact-confirm-dialog__ok') ||
      this.dialog.querySelector('[data-contact-confirm-close]');
    if (focusTarget) focusTarget.focus();

    return true;
  }

  closeDialog() {
    this.dialog.close();
  }

  onBackdropClick(event) {
    if (event.target === this.dialog) this.closeDialog();
  }

  onDialogClosed() {
    this.submitButton.focus();
  }
}

if (!customElements.get('contact-form-confirmation')) {
  customElements.define('contact-form-confirmation', ContactFormConfirmation);
}
