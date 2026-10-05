(() => {
  'use strict';
  const STORE = 'primer-negocio-recibe-v1';
  const $ = id => document.getElementById(id);
  const panel = $('panel');
  const messages = $('messages');
  const amounts = [100, 200, 300];
  let state = { stage: 'start', amount: 100, accessed: [], charge: null, confirmed: [] };
  try { const saved = JSON.parse(localStorage.getItem(STORE)); if (saved && ['start','material','choose','payment','later','thanks'].includes(saved.stage)) state = { ...state, ...saved }; } catch {}
  if (!amounts.includes(state.amount)) state.amount = 100;
  for (const key of ['accessed', 'confirmed']) if (!Array.isArray(state[key])) state[key] = [];
  if (state.charge && (!Number.isFinite(state.charge.expires) || !amounts.includes(state.charge.amount) || !['SPEI', 'OXXO'].includes(state.charge.method))) state.charge = null;
  let config = { ready: false }, busy = false, pollTimer, pollCount = 0;
  const money = n => `$${n} MXN`;
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} }
  function track(name, fields, key) {
    try { if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && typeof window.fbq === 'function') window.fbq('trackCustom', name, fields, { eventID: key }); } catch {}
  }
  function bubble(html, user = false) { messages.insertAdjacentHTML('beforeend', `<div class="bubble${user ? ' user' : ''}">${html}</div>`); }
  function material() {
    return `<div class="access-links"><div class="material-card"><img class="cover" src="/assets/recetario-cover.webp" alt="Portada del recetario"><div class="material-text"><h2>25 comidas económicas<br>para vender desde casa</h2><p>25 recetas · 56 páginas · costos estimativos</p><a class="file-link" data-material="recetario" href="/recibe/material/25-comidas.pdf" target="_blank" rel="noopener">Abrir o descargar ↗</a></div></div><div class="material-card"><img class="cover" src="/assets/bonus-cover.webp" alt="Portada de la ruta de pedidos"><div class="material-text"><h2>Tu primera ruta de pedidos</h2><p>Bono · 14 páginas · ejemplos para ofrecer</p><a class="file-link" data-material="bono" href="/recibe/material/ruta-de-pedidos.pdf" target="_blank" rel="noopener">Abrir o descargar ↗</a></div></div></div>`;
  }
  function move(stage, scroll = true) { state.stage = stage; save(); render(); if (scroll && matchMedia('(max-width:760px)').matches) document.querySelector('.conversation').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  function render() {
    clearTimeout(pollTimer); messages.innerHTML = ''; panel.innerHTML = '';
    $('my-material').hidden = state.stage === 'start';
    $('step1').classList.add('active'); $('step2').classList.toggle('active', state.stage !== 'start');
    $('step3').classList.toggle('active', ['choose','payment','later','thanks'].includes(state.stage));
    if (state.stage === 'start') {
      bubble('<p>¡Hola! Aquí puedes recibir <strong>25 ideas de comida para vender desde casa</strong> y una guía para ofrecerlas.</p><p>Primero te compartimos el material. Después, si te resulta útil, puedes hacer una aportación voluntaria.</p>');
      panel.innerHTML = `<h2 class="callout">Un primer paso.<br><span class="red">A tu ritmo.</span></h2><p class="subline">Sin registro y sin pagar para acceder.</p><button class="primary" data-action="material">Quiero recibir el material →</button><p class="fine">Puedes empezar por una receta y un lote pequeño.</p>`;
    } else if (state.stage === 'material') {
      bubble('Quiero recibir el material', true);
      bubble('<p><strong>¡Aquí lo tienes!</strong> Los dos archivos ya están disponibles.</p><p>Guárdalos y elige una receta que puedas preparar con facilidad. Sus costos son una referencia: ajústalos a tu zona.</p>');
      panel.innerHTML = `<span class="stamp">TU MATERIAL · ACCESO LIBRE</span>${material()}<button class="primary" data-action="choose">Ver cómo apoyar este proyecto →</button><button class="text-button later" data-action="later">Por ahora, solo quiero explorar</button>`;
    } else if (state.stage === 'choose') {
      bubble('Quiero ver cómo apoyar', true);
      bubble('<p>Si este material te ayuda a dar el primer paso, puedes apoyar su creación con una <strong>aportación única y voluntaria</strong>.</p><p>Elige lo que te acomode. Recibes el mismo material con cualquier opción, incluso si no aportas.</p>');
      panel.innerHTML = `<h2 class="callout">Tú eliges <span class="red">cómo apoyar.</span></h2><div class="amounts" role="group" aria-label="Monto de aportación">${amounts.map(n => `<button class="amount" data-amount="${n}" aria-pressed="${state.amount === n}"><b>$${n}</b><span>MXN · pago único</span></button>`).join('')}</div><p class="pay-label">Elige cómo realizar tu aportación:</p><div class="methods"><button class="method spei" data-method="SPEI"><b>SPEI</b><span>Desde tu banco</span><em>Generar CLABE →</em></button><button class="method oxxo" data-method="OXXO"><b>OXXO</b><span>En efectivo, en tienda</span><em>Generar referencia →</em></button></div><div id="payment-notice"></div><p class="provider">Procesamiento de pago por <b>XPag</b></p><button class="text-button later" data-action="later">Ahora no, gracias</button>`;
      if (!config.ready) $('payment-notice').innerHTML = '<p class="info">Las aportaciones están en preparación. Tu material ya está disponible y puedes guardarlo sin pagar.</p>';
      panel.querySelectorAll('[data-method]').forEach(b => b.disabled = !config.ready);
    } else if (state.stage === 'payment' && state.charge) {
      const c = state.charge;
      bubble(`Aportar ${money(c.amount)} con ${escape(c.method)}`, true);
      bubble(c.method === 'SPEI' ? '<p><strong>Tu CLABE está lista.</strong> Abre tu app bancaria y transfiere el importe exacto. Revisa el banco y el beneficiario antes de confirmar.</p>' : '<p><strong>Tu referencia OXXO está lista.</strong> Muéstrala en caja y paga el importe indicado. La tienda puede cobrar una comisión adicional.</p>');
      panel.innerHTML = `<div class="payment-details"><div class="payment-title"><b>${money(c.amount)}</b><span class="status" id="payment-state">Pendiente</span></div>${c.method === 'SPEI' ? `<div class="detail"><span>CLABE · 18 dígitos</span><strong class="code">${escape(c.clabe)}</strong><button class="copy" data-copy="clabe">Copiar CLABE</button></div><div class="detail"><span>Banco</span><strong>${escape(c.bank)}</strong></div><div class="detail"><span>Beneficiario</span><strong>${escape(c.beneficiary)}</strong></div>` : `<div class="detail"><span>Referencia OXXO</span><strong class="code">${escape(c.voucher)}</strong><button class="copy" data-copy="voucher">Copiar referencia</button></div>${c.barcode && /^https:\/\//.test(c.barcode) ? `<img class="barcode" src="${escape(c.barcode)}" alt="Código de barras de tu referencia OXXO" referrerpolicy="no-referrer">` : ''}`}<p class="expires">Vigencia orientativa: ${new Intl.DateTimeFormat('es-MX', {dateStyle:'medium',timeStyle:'short'}).format(new Date(c.expires))}. Conserva estas instrucciones.</p></div><button class="primary" data-action="check">Ya pagué · consultar estado →</button><div id="payment-notice"></div><p class="fine">La confirmación puede tardar, especialmente en OXXO.<br>Un clic en este botón no confirma el pago.</p><button class="secondary" data-action="material">Volver a mi material</button><p class="provider">Pago procesado por <b>XPag</b></p>`;
      pollCount = 0; schedule();
    } else if (state.stage === 'thanks') {
      bubble('<p><strong>¡Gracias por apoyar!</strong> XPag confirmó tu aportación. Puedes seguir consultando tu material cuando quieras.</p>');
      panel.innerHTML = `<div class="paid-mark" aria-hidden="true">✓</div><h2 class="callout" style="text-align:center">Un apoyo que <span class="red">se agradece.</span></h2>${material()}<p class="fine">Empieza con una receta, calcula tus costos y ofrece un lote por encargo. A tu ritmo.</p>`;
    } else {
      bubble('<p><strong>¡Claro! Disfruta el material.</strong> Empieza con algo sencillo: una receta, un lote pequeño y personas cerca de ti.</p><p>No tienes que aportar para usarlo. Si después quieres apoyar, puedes volver aquí.</p>');
      panel.innerHTML = `${material()}<button class="secondary" data-action="choose">Quiero apoyar después</button>`;
    }
    if (state.charge && state.stage === 'choose') {
      $('payment-notice').innerHTML = '<p class="info">Ya tienes una referencia pendiente. Úsala para evitar generar otro pago.</p><button class="secondary" data-action="resume">Ver mi pago pendiente →</button>';
      panel.querySelectorAll('[data-method]').forEach(b => b.disabled = true);
    }
    $('chat-body').scrollTop = 0;
  }
  async function request(endpoint, body) {
    const response = await fetch(`/api/${endpoint}`, { method:'POST', credentials:'same-origin', headers: {'Content-Type':'application/json','X-CSRF-Token':config.csrf || ''}, body:JSON.stringify(body), signal:AbortSignal.timeout(20_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No pudimos consultar el pago. Intenta de nuevo más tarde.');
    return data;
  }
  function notice(text, error = false) { if ($('payment-notice')) $('payment-notice').innerHTML = `<p class="${error ? 'error' : 'info'}">${escape(text)}</p>`; }
  async function create(method) {
    if (busy || state.charge || !config.ready) return;
    busy = true; panel.querySelectorAll('button').forEach(b => b.disabled = true);
    notice('Generando tus instrucciones con XPag…');
    try { state.charge = await request('contribution', {amount:state.amount, method}); save(); move('payment'); }
    catch (error) { notice(error.name === 'TimeoutError' ? 'La consulta tardó demasiado. No generes otra solicitud inmediatamente; consulta primero si tienes un pago pendiente en XPag.' : error.message, true); }
    finally { busy = false; if (!state.charge) panel.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  function schedule() { if (state.stage === 'payment' && state.charge && pollCount < 12 && !document.hidden) pollTimer = setTimeout(() => { pollCount++; check(false); }, 20_000); }
  async function check(manual) {
    if (busy || !state.charge || !config.ready) return;
    busy = true; const button = panel.querySelector('[data-action="check"]'); if (button) button.disabled = true;
    try {
      const result = await request('contribution-status', { token:state.charge.token });
      if (result.state === 'confirmed') {
        const id = state.charge.reference;
        if (!state.confirmed.includes(id)) { state.confirmed.push(id); track('ContributionConfirmed', {value:result.amount,currency:'MXN',method:result.method}, `contribution-${id}`); }
        state.charge = null; save(); move('thanks', false);
      } else if (result.state === 'closed') { state.charge = null; save(); move('choose', false); notice('Esta referencia venció o fue cerrada. Si pagaste, revisa el movimiento en tu banco y en XPag antes de crear otra.', true); }
      else if (manual) notice('XPag todavía muestra el pago pendiente. Conserva tu comprobante y vuelve a consultar más tarde. No pagues dos veces.');
    } catch (error) { if (manual) notice(error.message || 'No pudimos consultar. Conserva tu referencia.', true); }
    finally { busy = false; if (button?.isConnected) button.disabled = false; schedule(); }
  }
  panel.addEventListener('click', async event => {
    const link = event.target.closest('[data-material]');
    if (link) {
      const item = link.dataset.material;
      if (!state.accessed.includes(item)) { state.accessed.push(item); save(); track('MaterialAccess', {material:item,content_name:'Primer Negocio'}, `material-${item}-${crypto.randomUUID()}`); }
      return;
    }
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.amount) { state.amount = Number(button.dataset.amount); save(); panel.querySelectorAll('[data-amount]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.amount) === state.amount))); }
    else if (button.dataset.method) create(button.dataset.method);
    else if (button.dataset.copy) {
      try { await navigator.clipboard.writeText(state.charge[button.dataset.copy]); button.textContent = 'Copiado ✓'; } catch { button.textContent = 'Selecciona el número para copiar'; }
    } else if (button.dataset.action === 'check') { clearTimeout(pollTimer); check(true); }
    else if (button.dataset.action === 'resume') move('payment');
    else if (button.dataset.action) move(button.dataset.action);
  });
  $('my-material').addEventListener('click', () => move('material'));
  $('help-open').addEventListener('click', () => { $('help').hidden = !$('help').hidden; $('help-open').setAttribute('aria-expanded', String(!$('help').hidden)); });
  $('privacy-open').addEventListener('click', () => { $('privacy').hidden = !$('privacy').hidden; });
  $('clear-local').addEventListener('click', () => { try { localStorage.removeItem(STORE); } catch {} state = {stage:'start',amount:100,accessed:[],charge:null,confirmed:[]}; move('start'); $('privacy').hidden = true; });
  document.addEventListener('visibilitychange', () => { clearTimeout(pollTimer); if (!document.hidden) schedule(); });
  render();
  fetch('/api/funnel-config', { credentials:'same-origin', cache:'no-store' }).then(r => r.json()).then(data => { config = data; if (state.stage === 'choose') render(); if (state.stage === 'payment') check(false); }).catch(() => {});
})();
