(() => {
  'use strict';
  const config = window.SITE_CONFIG || { price: 100, currency: 'MXN', checkoutUrl: '' };
  const price = Number.isFinite(Number(config.price)) && Number(config.price) > 0 ? Number(config.price) : 100;
  const formattedPrice = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(price);
  document.querySelectorAll('[data-price]').forEach(node => {
    if (node.tagName === 'STRONG') node.innerHTML = `$${formattedPrice} <small>MXN</small>`;
    else node.textContent = `$${formattedPrice} MXN`;
  });
  const checkoutDialog = document.querySelector('#checkout-dialog');
  const previewDialog = document.querySelector('#preview-dialog');
  let previousFocus = null;
  function openDialog(dialog) {
    previousFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }
  function closeDialog(dialog) { dialog.close(); }
  [checkoutDialog, previewDialog].forEach(dialog => {
    dialog.querySelectorAll('.close-dialog,.close-checkout').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
      }
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      previousFocus?.focus({ preventScroll: true });
    });
  });
  function checkoutUrl() {
    if (!config.checkoutUrl) return null;
    try {
      const url = new URL(config.checkoutUrl);
      if (url.protocol !== 'https:') return null;
      const params = new URLSearchParams(location.search);
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].forEach(key => {
        if (params.has(key) && !url.searchParams.has(key)) url.searchParams.set(key, params.get(key));
      });
      return url.href;
    } catch { return null; }
  }
  document.querySelectorAll('[data-checkout]').forEach(button => button.addEventListener('click', () => {
    const url = checkoutUrl();
    if (!url) { openDialog(checkoutDialog); return; }
    if (button.dataset.redirecting === 'true') return;
    button.dataset.redirecting = 'true';
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', {
          value: price,
          currency: 'MXN',
          content_name: 'Primer Negocio - 25 Comidas + Bono',
          content_ids: ['primer-negocio-25-comidas'],
          content_type: 'product',
          num_items: 1,
        });
      }
    } catch { /* Tracking must never prevent the payment redirect. */ }
    // Short, bounded delay gives the pixel time to send without blocking purchase.
    setTimeout(() => {
      button.dataset.redirecting = 'false';
      location.assign(url);
    }, 180);
  }));
  const previews = {
    ingredients: { src: 'assets/recipe-ingredients.webp', alt: 'Ingredientes y rendimiento de tostadas de tinga', title: 'Ingredientes y porciones' },
    preparation: { src: 'assets/recipe-preparation.webp', alt: 'Preparación y números estimativos de tostadas de tinga', title: 'Preparación y números a la vista' },
  };
  document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => {
    const page = previews[button.dataset.preview];
    if (!page) return;
    document.querySelector('#preview-image').src = page.src;
    document.querySelector('#preview-image').alt = page.alt;
    document.querySelector('#preview-title').textContent = page.title;
    openDialog(previewDialog);
  }));
  document.querySelectorAll('.faq-list details').forEach(item => item.addEventListener('toggle', () => {
    if (item.open) document.querySelectorAll('.faq-list details').forEach(other => { if (other !== item) other.open = false; });
  }));
  let portions = 6;
  let days = 3;
  const money = value => '$' + new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
  function updateSimulation() {
    const revenue = portions * 65;
    const cost = portions * 42.5;
    const gross = revenue - cost;
    document.querySelector('#chart-cost').textContent = money(cost);
    document.querySelector('#chart-profit').textContent = money(gross);
    document.querySelector('#daily-revenue').textContent = money(revenue) + ' MXN';
    document.querySelector('#weekly-profit').innerHTML = money(gross * days) + ' <small>MXN</small>';
    document.querySelector('#weekly-revenue').textContent = money(revenue * days);
    document.querySelector('#weekly-cost').textContent = money(cost * days);
    document.querySelector('#weekly-equation').textContent = `${portions} porciones × ${days} ${days === 1 ? 'entrega' : 'entregas'} × $22.50 de ganancia bruta`;
    document.querySelector('#stacked-chart').setAttribute('aria-label', `Por entrega: costo ${cost} pesos, ganancia bruta ${gross} pesos, ingreso total ${revenue} pesos`);
    document.querySelectorAll('[data-portions]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.portions) === portions)));
    document.querySelectorAll('[data-days]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.days) === days)));
    document.querySelectorAll('[data-bar]').forEach(bar => bar.classList.toggle('selected', Number(bar.dataset.bar) === portions));
  }
  document.querySelectorAll('[data-portions]').forEach(button => button.addEventListener('click', () => { portions = Number(button.dataset.portions); updateSimulation(); }));
  document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => { days = Number(button.dataset.days); updateSimulation(); }));
  updateSimulation();
  const floatingCta = document.querySelector('.floating-cta');
  if ('IntersectionObserver' in window) {
    const directCtas = document.querySelectorAll('.hero-checkout,.offer-checkout');
    const visible = new Set();
    const ctaObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); });
      floatingCta.classList.toggle('is-hidden', visible.size > 0);
    }, { threshold: 0.15 });
    directCtas.forEach(node => ctaObserver.observe(node));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('motion-enabled');
      const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
      }), { threshold: 0.06 });
      document.querySelectorAll('.reveal').forEach(node => revealObserver.observe(node));
    }
  }
})();
