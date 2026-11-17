/**
 * A full load of an app page. Offline it goes through the service worker,
 * which opens the offline app on that page (spec 034 plan D3, R10); a soft
 * navigation would wait for the server.
 */
export function loadPage(href: string) {
  window.location.assign(href);
}
