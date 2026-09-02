if (!customElements.get('custom-message-field')) {
  customElements.define(
    'custom-message-field',
    class CustomMessageField extends HTMLElement {
      connectedCallback() {
        this.input = this.querySelector('.field__input');
        if (!this.input) return;

        this.counter = this.querySelector('.product-custom-message__counter');
        this.errorMessage = this.querySelector('.product-custom-message__error');
        this.maxLength = parseInt(this.dataset.maxLength, 10) || 0;
        this.isRequired = this.dataset.required === 'true';

        this.onInput = this.onInput.bind(this);
        this.onFormSubmit = this.onFormSubmit.bind(this);

        this.input.addEventListener('input', this.onInput);
        this.updateCounter();

        // `product-form.js` listens for `submit` on the form itself and builds the
        // FormData there, so this has to run first. Listening in the capture phase
        // from an ancestor gets us ahead of it.
        this.form = this.input.form;
        this.formHost = this.form?.parentElement;
        this.formHost?.addEventListener('submit', this.onFormSubmit, true);
      }

      disconnectedCallback() {
        this.input?.removeEventListener('input', this.onInput);
        this.formHost?.removeEventListener('submit', this.onFormSubmit, true);
      }

      onInput() {
        this.updateCounter();
        if (this.input.value.trim() !== '') this.setError(false);
      }

      updateCounter() {
        if (!this.counter || !this.maxLength) return;
        const length = this.input.value.length;
        this.counter.textContent = `${length}/${this.maxLength}`;
        this.counter.classList.toggle('is-at-limit', length >= this.maxLength);
      }

      onFormSubmit(event) {
        if (event.target !== this.form) return;

        if (this.input.value.trim() !== '') {
          this.setError(false);
          return;
        }

        if (this.isRequired) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.setError(true);
          this.input.focus();
          return;
        }

        // Keep an empty property out of the payload entirely, so the cart and the
        // order never show a blank line. Re-enabled once the FormData is built.
        this.input.disabled = true;
        setTimeout(() => {
          this.input.disabled = false;
        });
      }

      setError(hasError) {
        this.classList.toggle('product-custom-message--error', hasError);
        this.input.setAttribute('aria-invalid', hasError);
        if (this.errorMessage) this.errorMessage.toggleAttribute('hidden', !hasError);
      }
    }
  );
}
