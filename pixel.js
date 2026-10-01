/* Meta Pixel: visita à página. A compra é confirmada pelo checkout. */
(() => {
  'use strict';
  const pixelId = window.SITE_CONFIG?.pixelId;
  if (!/^\d+$/.test(pixelId || '')) return;
  // Standard Meta loader: events queue while fbevents.js loads asynchronously.
  !function(f,b,e,v,n,t,s) {
    if(f.fbq) return;
    n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq) f._fbq=n;
    n.push=n;n.loaded=true;n.version='2.0';n.queue=[];
    t=b.createElement(e);t.async=true;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
})();
