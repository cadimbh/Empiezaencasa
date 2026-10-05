(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RecibeState = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const amounts = [100, 200, 300];
  const methods = ['SPEI', 'OXXO'];
  const stages = ['welcome', 'intent', 'material', 'guide', 'choose', 'payment', 'later', 'thanks'];
  function initial() { return {stage:'welcome',amount:100,intent:'opciones',accessed:[],charges:[],currentRef:null,confirmed:[]}; }
  function validCharge(c) {
    return c && typeof c.reference === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(c.reference) &&
      typeof c.token === 'string' && c.token.length > 20 && c.token.length < 4001 &&
      Number.isFinite(c.expires) && amounts.includes(c.amount) && methods.includes(c.method) &&
      (c.method === 'SPEI' ? /^\d{18}$/.test(c.clabe || '') && typeof c.bank === 'string' && typeof c.beneficiary === 'string' : /^\d{8,40}$/.test(c.voucher || ''));
  }
  function normalize(saved) {
    const state = initial();
    if (!saved || typeof saved !== 'object') return state;
    if (amounts.includes(saved.amount)) state.amount = saved.amount;
    if (['antojos','comidas','opciones'].includes(saved.intent)) state.intent = saved.intent;
    state.stage = stages.includes(saved.stage) ? saved.stage : saved.stage === 'start' ? 'welcome' : state.stage;
    for (const field of ['accessed','confirmed']) {
      if (Array.isArray(saved[field])) state[field] = [...new Set(saved[field].filter(x => typeof x === 'string').slice(-50))];
    }
    const charges = Array.isArray(saved.charges) ? [...saved.charges] : [];
    if (saved.charge) charges.push(saved.charge); // Migrate the original single pending reference, without clearing it.
    for (const c of charges.filter(validCharge)) {
      putCharge(state, {...c,status:['pending','confirmed','closed'].includes(c.status) ? c.status : 'pending'});
    }
    if (typeof saved.currentRef === 'string' && state.charges.some(c=>c.reference === saved.currentRef)) state.currentRef = saved.currentRef;
    else if (validCharge(saved.charge)) state.currentRef = saved.charge.reference;
    // Returning visitors choose freely. Saved references remain available; they never lock the selector.
    if (state.stage === 'payment') state.stage = 'choose';
    return state;
  }
  function putCharge(state, charge) {
    if (!validCharge(charge)) return false;
    const index = state.charges.findIndex(c=>c.reference === charge.reference);
    if (index >= 0) state.charges[index] = charge;
    else state.charges.push(charge);
    return true;
  }
  function reusable(state, amount, method, now = Date.now()) {
    return [...state.charges].reverse().find(c=>validCharge(c) && c.amount === amount && c.method === method && c.expires > now && c.status === 'pending') || null;
  }
  function selected(state) { return state.charges.find(c=>c.reference === state.currentRef) || null; }
  return {amounts,methods,initial,normalize,validCharge,putCharge,reusable,selected};
});
