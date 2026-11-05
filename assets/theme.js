/* Aparência: claro, escuro (cinza) ou automático. Preferência guardada só neste navegador. */
'use strict';
(function () {
  const sel = document.getElementById('themeSel'); if (!sel) return;
  const get = () => { try { return localStorage.getItem('compizzo.theme') || 'light'; } catch (e) { return 'light'; } };
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme:dark)') : null;
  const apply = m => { document.documentElement.dataset.theme = m === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : m; };
  sel.value = get(); apply(sel.value);
  sel.addEventListener('change', () => { try { localStorage.setItem('compizzo.theme', sel.value); } catch (e) { /* sem armazenamento */ } apply(sel.value); });
  if (mq) mq.addEventListener('change', () => { if (get() === 'auto') apply('auto'); });
})();
