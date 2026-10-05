// Local previews never send marketing events. Production keeps the same PageView initialization.
(() => {
  if (['localhost', '127.0.0.1', '::1'].includes(location.hostname)) return;
  const id = window.SITE_CONFIG?.pixelId;
  if (!/^\d+$/.test(id || '')) return;
  if (!window.fbq) {
    const queue = window.fbq = function () { queue.callMethod ? queue.callMethod.apply(queue, arguments) : queue.queue.push(arguments); };
    window._fbq = queue; queue.push = queue; queue.loaded = true; queue.version = '2.0'; queue.queue = [];
    const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.append(script);
  }
  window.fbq('init', id);
  window.fbq('track', 'PageView');
})();
