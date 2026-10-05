(() => {
  'use strict';
  const S = window.RecibeState;
  const STORE = 'primer-negocio-recibe-v2';
  const LEGACY = 'primer-negocio-recibe-v1';
  const $ = id => document.getElementById(id);
  const panel = $('panel'), messages = $('messages');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const money = n => '$' + n + ' MXN';
  let state;
  try { state = S.normalize(JSON.parse(localStorage.getItem(STORE) || localStorage.getItem(LEGACY) || 'null')); } catch { state = S.initial(); }
  let config = {ready:false,loading:true}, configPromise, creating = false, pollTimer, pollCount = 0;
  const checking = new Set();
  let conversationVisible = false;
  const intents = {
    antojos:{label:'Antojitos para vender',recipe:'tostadas de tinga',tip:'Prepara el guiso y entrega las tostadas por separado para conservarlas crujientes.'},
    comidas:{label:'Comidas por encargo',recipe:'picadillo con papa',tip:'Ofrece una sola comida y define una hora de entrega antes de comprar ingredientes.'},
    opciones:{label:'Quiero ver las opciones',recipe:'una receta que ya sepas preparar',tip:'Empieza con una receta sencilla y revisa primero el costo de sus ingredientes.'}
  };
  const offerText = '¡Hola! Este [día] prepararé [platillo] por encargo. La porción cuesta [$precio MXN] y la entrega será en [lugar/hora]. ¿Te gustaría apartar una? Tomo pedidos hasta [hora].';
  function save() { try { localStorage.setItem(STORE,JSON.stringify(state)); } catch {} }
  function track(name,fields,key) { try { if (!['localhost','127.0.0.1'].includes(location.hostname) && typeof window.fbq === 'function') window.fbq('trackCustom',name,fields,{eventID:key}); } catch {} }
  function bubble(html,user=false) { messages.insertAdjacentHTML('beforeend','<div class="bubble'+(user?' user':'')+'">'+html+'</div>'); }
  function primary(label,action) { return '<button class="primary" data-action="'+action+'">'+label+icon('arrow')+'</button>'; }
  function provider() { return '<p class="provider">'+icon('lock')+' Pago procesado por <b>XPag</b></p>'; }
  function material() {
    return '<div class="access-links">'+[{id:'recetario',cover:'recetario-cover',tag:'TU RECETARIO COMPLETO',title:'25 comidas económicas',detail:'Ingredientes · preparación · costos estimativos',file:'25-comidas',label:'Abrir mi recetario'},{id:'bono',cover:'bonus-cover',tag:'TU BONO DE VENTAS',title:'Tu primera ruta de pedidos',detail:'Un plan sencillo + mensajes para ofrecer',file:'ruta-de-pedidos',label:'Abrir mi bono'}].map(m=>'<div class="material-card"><img class="cover" src="/assets/'+m.cover+'.webp" alt="Portada de '+m.title+'"><div class="material-text"><span class="mini-label">'+m.tag+'</span><h3>'+m.title+'</h3><p>'+m.detail+'</p><a class="file-link" data-material="'+m.id+'" href="/recibe/material/'+m.file+'.pdf" target="_blank" rel="noopener">'+m.label+icon('arrow')+'</a></div></div>').join('')+'</div>';
  }
  function date(expires) { return new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(expires)); }
  function history() {
    if (!state.charges.length) return '';
    return '<details class="history"><summary>Mis referencias guardadas ('+state.charges.length+')</summary>'+[...state.charges].reverse().map(c=>'<div class="history-item"><span>'+money(c.amount)+' · '+esc(c.method)+'<small>'+(c.status==='confirmed'?'Confirmado por XPag':c.status==='closed'?'Cerrada por XPag':c.expires<=Date.now()?'Vigencia orientativa terminada':'Pendiente · vigencia orientativa '+date(c.expires))+'</small></span><button data-reference="'+esc(c.reference)+'">Ver datos</button></div>').join('')+'<p class="fine">Cambiar de opción no cancela una referencia anterior. Si ya pagaste, no pagues de nuevo.</p></details>';
  }
  function updateMobile() { $('mobile-receive-bar').hidden = conversationVisible || $('preview-dialog').open; }
  function focusConversation() {
    document.querySelector('.conversation').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  }
  function move(stage,scroll=true) { state.stage=stage;save();render();if(scroll)focusConversation(); }
  function notice(text,error=false) { const n=$('payment-notice');if(n)n.innerHTML='<p class="'+(error?'error':'info')+'">'+esc(text)+'</p>'; }
  function setBusyUI() {
    panel.setAttribute('aria-busy',String(creating));
    panel.querySelectorAll('[data-method]').forEach(b=>b.disabled=creating || !config.ready);
    panel.querySelectorAll('[data-amount]').forEach(b=>b.disabled=creating);
    const button=panel.querySelector('[data-action="check"]');if(button)button.disabled=checking.has(state.currentRef)||!config.ready;
  }
  function render() {
    clearTimeout(pollTimer);messages.innerHTML='';panel.innerHTML='';
    $('step1').classList.add('active');$('step2').classList.toggle('active',['guide','choose','payment','later','thanks'].includes(state.stage));$('step3').classList.toggle('active',['choose','payment','thanks'].includes(state.stage));
    if(state.stage==='welcome') {
      bubble('<p><strong>¡Hola! Vamos a convertir esa idea en un primer paso.</strong></p><p>Aquí recibirás 25 recetas para vender y el bono con una ruta para ofrecerlas. Te los compartimos primero: puedes abrirlos y guardarlos sin pagar.</p>');
      panel.innerHTML='<h2 class="callout">Una receta para empezar.<br><span class="red">Un plan para ofrecerla.</span></h2><div class="welcome-includes">'+icon('check')+' El recetario y el bono completos, desde el inicio.</div>'+primary('Sí, quiero recibirlos','intent')+'<p class="fine">Después, si te resultan útiles, puedes apoyar el trabajo detrás del material.</p>';
    } else if(state.stage==='intent') {
      bubble('Quiero recibir mi recetario + bono',true);
      bubble('<p><strong>Antes, una pregunta rápida:</strong> ¿con qué te gustaría empezar?</p><p>Así te doy una idea concreta para aprovechar el material.</p>');
      panel.innerHTML='<div class="intent-options">'+Object.entries(intents).map(([key,item])=>'<button class="intent-option" data-intent="'+key+'">'+item.label+'<span>→</span></button>').join('')+'</div><p class="fine">Recibes las 25 recetas con cualquier opción.</p>';
    } else if(state.stage==='material') {
      const item=intents[state.intent];bubble(item.label,true);
      bubble('<p><strong>¡Aquí tienes tu paquete completo!</strong> El recetario y el bono ya son tuyos para consultar.</p><p>Puedes empezar por <strong>'+item.recipe+'</strong>. Abre los dos materiales y guárdalos en tu celular.</p>');
      panel.innerHTML='<span class="stamp">'+icon('check')+' ACCESO LIBRE · LOS DOS MATERIALES</span>'+material()+primary('Ahora, ¿cómo doy el primer paso?','guide')+'<button class="text-button later" data-action="later">Prefiero explorar el material</button>';
    } else if(state.stage==='guide') {
      bubble('¿Cómo puedo empezar?',true);
      bubble('<p><strong>Hazlo pequeño y concreto.</strong> No necesitas ofrecer 25 platos a la vez. Una receta y un primer lote te permiten probar tu idea.</p><p>'+intents[state.intent].tip+'</p>');
      panel.innerHTML='<h2 class="callout">Tu primer pedido empieza<br><span class="red">con una propuesta clara.</span></h2><div class="start-plan"><ol><li><div><b>Elige un solo platillo.</b>Practica la receta y define una porción.</div></li><li><div><b>Ajusta el costo a tu zona.</b>Incluye ingredientes, empaque y gastos de entrega.</div></li><li><div><b>Ofrece por encargo.</b>Define precio, lugar y hora antes de producir.</div></li></ol></div><div class="message-example"><span>UN MENSAJE PARA ADAPTAR Y OFRECER</span><p id="offer-text">'+esc(offerText)+'</p><button class="copy" data-copy-offer>Copiar este mensaje</button><span id="copy-offer-status" class="copy-status" aria-live="polite"></span></div><div class="give-note">'+icon('heart')+'<p>Ya tienes las recetas, el bono y un primer paso. Si te ayudan, puedes reconocer el trabajo detrás del material con una aportación voluntaria.</p></div>'+primary('Quiero apoyar este proyecto','choose')+'<button class="text-button later" data-action="later">Por ahora, quiero ponerlo en práctica</button>';
    } else if(state.stage==='choose') {
      bubble('Quiero apoyar el proyecto',true);
      bubble('<p><strong>Gracias por darle una oportunidad a este material.</strong></p><p>Tu aportación reconoce el trabajo detrás del recetario y del bono. Elige lo que te acomode: es un apoyo único y voluntario.</p>');
      panel.innerHTML='<h2 class="callout">Lo recibiste primero.<br><span class="red">Ahora, tú decides.</span></h2><div class="amounts" role="group" aria-label="Monto de aportación">'+S.amounts.map(n=>'<button class="amount" data-amount="'+n+'" aria-pressed="'+(state.amount===n)+'"><b>$'+n+'</b><span>MXN · una sola vez</span></button>').join('')+'</div><p class="pay-label">¿Cómo prefieres aportar '+money(state.amount)+'?</p><div class="methods">'+S.methods.map(method=>{const old=S.reusable(state,state.amount,method);return '<button class="method '+method.toLowerCase()+'" data-method="'+method+'"><b>'+method+'</b><span>'+(method==='SPEI'?'Desde tu app bancaria':'En efectivo, en tienda')+'</span><em>'+(old?'Usar mi referencia →':method==='SPEI'?'Obtener CLABE →':'Obtener referencia →')+'</em><small>'+(old?'Ya está guardada en este navegador':'Instrucciones para tu aportación')+'</small></button>';}).join('')+'</div><div id="payment-notice"></div>'+provider()+'<p class="fine">El mismo material, aportes o no. Sin suscripción.</p><button class="text-button later" data-action="later">Ahora no, gracias</button>'+history();
      if(config.loading)notice('Conectando con los métodos de pago…');
      else if(!config.ready){notice(config.error?'No pudimos conectar. Tus materiales siguen disponibles.':'Las aportaciones todavía no están disponibles. Puedes guardar tu material sin pagar.',true);$('payment-notice').insertAdjacentHTML('beforeend','<button class="secondary" data-action="retry-config">Volver a conectar</button>');}
      if(creating)notice('Generando tus instrucciones con XPag…');
    } else if(state.stage==='payment' && S.selected(state)) {
      const c=S.selected(state);bubble('Aportar '+money(c.amount)+' con '+esc(c.method),true);
      bubble(c.method==='SPEI'?'<p><strong>Tu CLABE está lista.</strong> Transfiere el importe exacto desde tu app bancaria, usando el banco y el beneficiario indicados.</p>':'<p><strong>Tu referencia OXXO está lista.</strong> Muéstrala en caja y paga el importe indicado. La tienda puede cobrar una comisión adicional.</p>');
      panel.innerHTML='<div class="payment-details"><div class="payment-title"><b>'+money(c.amount)+'</b><span class="status'+(c.status==='confirmed'?' confirmed':'')+'">'+(c.status==='confirmed'?'Confirmado por XPag':c.status==='closed'?'Cerrada':'Pendiente')+'</span></div>'+(c.method==='SPEI'?'<div class="detail"><span>CLABE · 18 dígitos</span><strong class="code">'+esc(c.clabe)+'</strong><button class="copy" data-copy="clabe">Copiar CLABE</button></div><div class="detail"><span>Banco</span><strong>'+esc(c.bank)+'</strong></div><div class="detail"><span>Beneficiario · datos devueltos por XPag</span><strong>'+esc(c.beneficiary)+'</strong></div>':'<div class="detail"><span>Referencia OXXO</span><strong class="code">'+esc(c.voucher)+'</strong><button class="copy" data-copy="voucher">Copiar referencia</button></div>'+(c.barcode && /^https:\/\//.test(c.barcode)?'<img class="barcode" src="'+esc(c.barcode)+'" alt="Código de barras de tu referencia OXXO" referrerpolicy="no-referrer">':''))+'<p class="expires">Vigencia orientativa: '+date(c.expires)+'. Conserva estas instrucciones.</p></div>'+primary('Consultar estado de mi aportación','check')+'<div id="payment-notice"></div><button class="secondary" data-action="choose">Cambiar monto o método</button><button class="text-button later" data-action="material">Volver a mi recetario y bono</button><p class="fine">Cambiar de opción no cancela la anterior. Si ya pagaste, no pagues dos veces. Un clic no confirma el pago.</p>'+provider();
      if(c.expires<=Date.now() && c.status==='pending')notice('La vigencia orientativa terminó. Si ya pagaste, consulta el estado antes de generar otra referencia.',true);
      if(c.status==='pending')schedule();
    } else if(state.stage==='thanks') {
      bubble('<p><strong>¡Gracias por tu aportación!</strong> XPag confirmó el pago. Gracias por apoyar el trabajo detrás de este material.</p>');
      panel.innerHTML='<div class="paid-mark">'+icon('check')+'</div><h2 class="callout" style="text-align:center">Ahora, a poner<br><span class="red">tu idea en práctica.</span></h2>'+material()+primary('Ver mi primer paso','guide')+history();
    } else {
      bubble('<p><strong>¡Claro! Empieza por tu receta favorita.</strong> Tu recetario y tu bono siguen disponibles. Puedes volver cuando quieras.</p><p>Si más adelante te resultan útiles y deseas apoyar, aquí encontrarás esa opción.</p>');
      panel.innerHTML=material()+primary('Ver un primer paso para ofrecer','guide')+'<button class="secondary" data-action="choose">Quiero apoyar el proyecto</button>'+history();
    }
    setBusyUI();updateMobile();
  }
  async function loadConfig() {
    if(configPromise)return configPromise;
    config={...config,loading:true};
    configPromise=(async()=>{try{const r=await fetch('/api/funnel-config',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12_000)});if(!r.ok)throw new Error();const data=await r.json();config={...data,loading:false,error:false};}catch{config={ready:false,loading:false,error:true};}finally{configPromise=null;if(state.stage==='choose')render();else setBusyUI();}})();
    return configPromise;
  }
  async function request(endpoint,body) {
    const response=await fetch('/api/'+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':config.csrf || ''},body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)});
    const data=await response.json();
    if(!response.ok){const error=new Error(data.error || 'No pudimos consultar. Intenta más tarde.');error.status=response.status;throw error;}
    return data;
  }
  async function create(method) {
    if(creating || !config.ready)return;
    const amount=state.amount;
    const existing=S.reusable(state,amount,method);
    if(existing){state.currentRef=existing.reference;pollCount=0;move('payment');return;}
    creating=true;setBusyUI();notice('Generando tus instrucciones con XPag…');
    try {
      // Refresh the anonymous session before generation; never retry a charge automatically.
      await loadConfig();if(!config.ready)throw new Error('No pudimos conectar con los métodos de pago. Vuelve a intentarlo más tarde.');
      const result=await request('contribution',{amount,method});const c={...result,status:'pending'};
      if(!S.putCharge(state,c))throw new Error('Las instrucciones no llegaron completas. Revisa primero si XPag registró una referencia antes de intentar de nuevo.');
      state.currentRef=c.reference;save();pollCount=0;
      if(state.stage==='choose')move('payment');
    }catch(error){notice(error.name==='TimeoutError'?'La solicitud tardó demasiado. Puede haberse generado una referencia. No repitas inmediatamente; consulta primero en XPag.':error.message,true);}
    finally{creating=false;setBusyUI();}
  }
  function schedule() {
    clearTimeout(pollTimer);const c=S.selected(state);
    if(state.stage==='payment' && c?.status==='pending' && !c.queryUnavailable && config.ready && pollCount<12 && !document.hidden)pollTimer=setTimeout(()=>{pollCount++;check(false);},20_000);
  }
  async function check(manual) {
    const c=S.selected(state);if(!c || checking.has(c.reference))return;
    if(!config.ready){if(manual){await loadConfig();if(!config.ready){notice('No pudimos conectar. Conserva tu referencia y consulta más tarde.',true);return;}}else return;}
    checking.add(c.reference);setBusyUI();
    try {
      const result=await request('contribution-status',{token:c.token});
      if(result.state==='confirmed'){
        c.status='confirmed';c.queryUnavailable=false;
        if(!state.confirmed.includes(c.reference)){state.confirmed.push(c.reference);track('ContributionConfirmed',{value:result.amount,currency:'MXN',method:result.method},'contribution-'+c.reference);}
        save();if(state.stage==='payment' && state.currentRef===c.reference)move('thanks',false);
      }else if(result.state==='closed'){
        c.status='closed';save();if(state.stage==='payment' && state.currentRef===c.reference){move('choose',false);notice('XPag cerró esta referencia. Si pagaste, revisa el movimiento antes de generar otra.',true);}
      }else if(manual && state.stage==='payment' && state.currentRef===c.reference)notice('XPag todavía muestra el pago pendiente. Conserva tu comprobante y vuelve a consultar más tarde. No pagues dos veces.');
    }catch(error){
      if([400,403].includes(error.status)){c.queryUnavailable=true;save();}
      if(manual && state.stage==='payment' && state.currentRef===c.reference)notice(c.queryUnavailable?'No pudimos consultar esta referencia guardada desde la sesión actual. Conserva sus datos. Puedes cambiar de opción sin borrar cookies; si ya pagaste, verifica el movimiento en XPag antes de pagar otra vez.':error.message,true);
    }finally{checking.delete(c.reference);setBusyUI();schedule();}
  }
  panel.addEventListener('click',async event=>{
    const link=event.target.closest('[data-material]');
    if(link){const item=link.dataset.material;if(!state.accessed.includes(item)){state.accessed.push(item);save();track('MaterialAccess',{material:item,content_name:'Primer Negocio'},'material-'+item+'-'+crypto.randomUUID());}return;}
    const b=event.target.closest('button');if(!b || b.disabled)return;
    if(b.dataset.intent){state.intent=b.dataset.intent;move('material');}
    else if(b.dataset.amount){state.amount=Number(b.dataset.amount);save();render();}
    else if(b.dataset.method)create(b.dataset.method);
    else if(b.dataset.reference){state.currentRef=b.dataset.reference;pollCount=0;move('payment');}
    else if(b.hasAttribute('data-copy-offer')){try{await navigator.clipboard.writeText(offerText);$('copy-offer-status').textContent='Copiado. Cambia los datos entre corchetes antes de enviarlo.';}catch{$('copy-offer-status').textContent='Selecciona el mensaje para copiarlo. Cambia los datos entre corchetes.';}}
    else if(b.dataset.copy){const c=S.selected(state);try{await navigator.clipboard.writeText(c[b.dataset.copy]);b.textContent='Copiado ✓';}catch{b.textContent='Selecciona el número para copiar';}}
    else if(b.dataset.action==='check'){clearTimeout(pollTimer);check(true);}
    else if(b.dataset.action==='retry-config'){await loadConfig();}
    else if(b.dataset.action)move(b.dataset.action);
  });
  function start(){move(state.stage==='welcome' || state.stage==='intent'?'intent':'material');}
  document.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',start));
  $('my-material').addEventListener('click',()=>move('material'));
  $('mobile-receive').addEventListener('click',start);
  $('help-open').addEventListener('click',()=>{$('help').hidden=!$('help').hidden;$('help-open').setAttribute('aria-expanded',String(!$('help').hidden));});
  $('privacy-open').addEventListener('click',()=>{$('privacy').hidden=!$('privacy').hidden;$('privacy-open').setAttribute('aria-expanded',String(!$('privacy').hidden));});
  $('clear-local').addEventListener('click',()=>{try{localStorage.removeItem(STORE);localStorage.removeItem(LEGACY);}catch{}state=S.initial();move('welcome');$('privacy').hidden=true;});
  document.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',()=>{
    const recipe=b.dataset.preview==='recetario';$('preview-title').textContent=recipe?'Páginas reales del recetario':'Tu primera ruta de pedidos';
    $('preview-content').innerHTML=recipe?'<div class="preview-pages"><img src="/assets/recipe-ingredients.webp" alt="Página real con tostadas de tinga, ingredientes, tiempo y porciones"><img src="/assets/recipe-preparation.webp" alt="Página real con preparación y costos estimativos de tostadas de tinga"></div>':'<div class="preview-bonus"><img src="/assets/bonus-cover.webp" alt="Portada real del bono de ventas"><div><h3>Un platillo.<br>Una zona.<br>Una hora.</h3><p>Una ruta práctica para empezar con un menú pequeño y pedidos cerca de casa.</p><ul><li>Elige un plato y organiza tu primer lote.</li><li>Ofrece por WhatsApp o en negocios cercanos.</li><li>Adapta los mensajes y organiza los pedidos.</li></ul><p>El bono completo tiene 14 páginas y está incluido desde el inicio.</p></div></div>';
    $('preview-dialog').showModal();updateMobile();
  }));
  $('preview-close').addEventListener('click',()=>{$('preview-dialog').close();updateMobile();});
  $('preview-dialog').addEventListener('close',updateMobile);
  $('preview-receive').addEventListener('click',()=>{$('preview-dialog').close();start();});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{conversationVisible=entries[0].isIntersecting;updateMobile();},{threshold:0,rootMargin:'-70px 0px -100px 0px'}).observe(document.querySelector('.conversation'));
  document.addEventListener('visibilitychange',()=>{clearTimeout(pollTimer);if(!document.hidden)schedule();});
  render();save();loadConfig().then(schedule);
})();
