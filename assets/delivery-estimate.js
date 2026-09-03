if (!customElements.get('delivery-estimate')) {
  customElements.define(
    'delivery-estimate',
    class DeliveryEstimate extends HTMLElement {
      connectedCallback() {
        const minimumDays = Math.max(1, Number(this.dataset.minDays) || 5);
        const maximumDays = Math.max(minimumDays, Number(this.dataset.maxDays) || 7);
        if (!Number.isFinite(minimumDays) || !Number.isFinite(maximumDays)) return;

        const locale = this.dataset.locale || document.documentElement.lang || 'en';
        let formatter;
        try {
          formatter = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric' });
        } catch (e) {
          formatter = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' });
        }

        // The heading promises "order now", so an order placed after the cutoff
        // (or on a weekend) does not get picked today - the whole window shifts
        // by a business day. The original version ignored this and would promise
        // same-day dispatch at 11pm on a Sunday.
        const now = new Date();
        const cutoffHour = Number(this.dataset.cutoffHour);
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        const pastCutoff = Number.isFinite(cutoffHour) && now.getHours() >= cutoffHour;
        const offset = isWeekend || pastCutoff ? 1 : 0;

        const addBusinessDays = (days) => {
          const date = new Date();
          date.setHours(12, 0, 0, 0);
          let addedDays = 0;

          while (addedDays < days) {
            date.setDate(date.getDate() + 1);
            const weekday = date.getDay();
            if (weekday !== 0 && weekday !== 6) addedDays += 1;
          }

          return date;
        };

        // Build the datetime attribute from local parts, not toISOString(): the
        // dates are computed at local noon, and toISOString() converts to UTC,
        // which lands on the previous day for UTC+13 and UTC+14. That would make
        // the machine-readable date disagree with the visible one.
        const isoDate = (date) =>
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
            date.getDate()
          ).padStart(2, '0')}`;

        const updateDate = (selector, date) => {
          const element = this.querySelector(selector);
          if (!element) return;
          element.textContent = formatter.format(date);
          element.dateTime = isoDate(date);
        };

        updateDate('[data-delivery-start]', addBusinessDays(minimumDays + offset));
        updateDate('[data-delivery-end]', addBusinessDays(maximumDays + offset));
      }
    }
  );
}
