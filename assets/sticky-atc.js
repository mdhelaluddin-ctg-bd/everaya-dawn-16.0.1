/*
 * <sticky-atc> — floating add-to-cart bar (mobile).
 *
 * Shown whenever the main add-to-cart button is outside the viewport and
 * hidden as soon as it scrolls into view. The bar holds no state of its own:
 *  - its submit button is wired to the main product form via `form`, so the
 *    add itself goes through Dawn's product-form AJAX + cart drawer;
 *  - its quantity buttons click Dawn's <quantity-input> buttons, so quantity
 *    rules, volume pricing and the cart-count label keep working untouched;
 *  - label / disabled / loading state mirror the main button, which Dawn
 *    mutates in place on variant change.
 */
if (!customElements.get('sticky-atc')) {
  customElements.define(
    'sticky-atc',
    class StickyAtc extends HTMLElement {
      connectedCallback() {
        this.sectionId = this.dataset.sectionId;
        this.mainButton = document.getElementById(`ProductSubmitButton-${this.sectionId}`);
        this.mainQuantity = document.getElementById(`Quantity-${this.sectionId}`);
        this.stickyButton = this.querySelector('.sticky-atc__button');
        this.quantityValue = this.querySelector('[data-sticky-quantity-value]');
        this._visible = false;

        // No purchasable form on the page → nothing to mirror.
        if (!this.mainButton) return;

        // Reveal whenever the real button is off screen, in either direction.
        this.observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              this.conceal();
            } else {
              this.reveal();
            }
          },
          { threshold: 0 }
        );
        this.observer.observe(this.mainButton);

        // Mirror availability / label.
        this.syncButton();
        this.buttonObserver = new MutationObserver(() => this.syncButton());
        this.buttonObserver.observe(this.mainButton, {
          attributes: true,
          attributeFilter: ['disabled', 'aria-disabled', 'class'],
          childList: true,
          subtree: true,
          characterData: true,
        });

        this.bindQuantity();
      }

      disconnectedCallback() {
        this.observer?.disconnect();
        this.buttonObserver?.disconnect();
        this.mainQuantity?.removeEventListener('change', this.onQuantityChange);
      }

      reveal() {
        if (this._visible) return;
        this._visible = true;
        this.hidden = false;
        window.requestAnimationFrame(() => this.classList.add('sticky-atc--visible'));
      }

      conceal() {
        if (!this._visible) return;
        this._visible = false;
        this.classList.remove('sticky-atc--visible');
      }

      bindQuantity() {
        if (!this.quantityValue || !this.mainQuantity) return;

        this.onQuantityChange = () => this.syncQuantity();
        this.mainQuantity.addEventListener('change', this.onQuantityChange);
        this.syncQuantity();

        this.querySelectorAll('[data-sticky-quantity-step]').forEach((button) => {
          button.addEventListener('click', () => {
            // Defer to Dawn's own stepper so its min/max and quantity-rule
            // handling stays the single implementation.
            const step = button.dataset.stickyQuantityStep;
            const mainStep = this.mainQuantity
              .closest('quantity-input')
              ?.querySelector(`.quantity__button[name="${step}"]`);
            if (mainStep) {
              mainStep.click();
            }
            // Dawn fires `change` on the input, which calls syncQuantity; this
            // covers the case where the stepper markup is absent.
            this.syncQuantity();
          });
        });
      }

      syncQuantity() {
        this.quantityValue.textContent = this.mainQuantity.value;
      }

      syncButton() {
        if (!this.stickyButton) return;
        // Mirror Dawn's loading state (it only toggles these on the main button).
        const loading = this.mainButton.classList.contains('loading');
        this.stickyButton.disabled = loading || this.mainButton.disabled || this.mainButton.hasAttribute('disabled');
        this.stickyButton.classList.toggle('loading', loading);
        this.stickyButton.setAttribute('aria-disabled', loading ? 'true' : 'false');
        const spinner = this.stickyButton.querySelector('.loading__spinner');
        if (spinner) spinner.classList.toggle('hidden', !loading);

        // Mirror label text without clobbering the spinner markup.
        const mainLabel = this.mainButton.querySelector('span');
        const stickyLabel = this.stickyButton.querySelector('.sticky-atc__button-text');
        if (mainLabel && stickyLabel && mainLabel.textContent.trim()) {
          stickyLabel.textContent = mainLabel.textContent.trim();
        }
      }
    }
  );
}
