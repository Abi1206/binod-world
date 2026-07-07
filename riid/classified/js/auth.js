// RIID Classified Network — access gate
// Roleplay-flavor only: this is a static site with no backend, so this can
// never be real access control. It mirrors the spec's own literal dev
// credentials (view-source reveals them) rather than pretending otherwise.
(function () {
  if (sessionStorage.getItem('riid_auth') !== 'granted') {
    location.replace('login.html');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('riid_auth');
      location.href = 'login.html';
    });
  });
});
