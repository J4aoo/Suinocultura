/* ==========================================================================
   app.js — roteador, navegação e inicialização
   ========================================================================== */
const App = (function () {
  'use strict';

  const ROUTES = ['painel', 'lotes', 'manejo', 'matrizes', 'partos', 'financeiro', 'estoque', 'relatorios', 'ajustes'];
  const els = {};
  let current = 'painel';
  let renderToken = 0;

  function cacheEls() {
    els.view = document.getElementById('view');
    els.title = document.getElementById('page-title');
    els.sub = document.getElementById('page-sub');
    els.sidebar = document.getElementById('sidebar');
    els.scrimNav = document.getElementById('scrim-nav');
    els.hamburger = document.getElementById('hamburger');
    els.brandName = document.getElementById('brand-name');
    els.footStatus = document.getElementById('foot-status');
  }

  /* ---------------- Navegação ---------------- */

  function routeFromHash() {
    const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    if (ROUTES.indexOf(h) >= 0) return h;
    return null;
  }

  function navigate(route, opts) {
    const next = ROUTES.indexOf(route) >= 0 ? route : 'painel';
    if (location.hash !== '#/' + next) {
      history.replaceState(null, '', '#/' + next);
    }
    current = next;
    render();
    if (opts && opts.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    }
    closeNav();
  }

  /* ---------------- Render ---------------- */

  function render() {
    const view = Views.get(current);
    if (!view || !els.view) return;

    renderToken++;
    Views.destroyCharts();

    els.title.textContent = view.title || 'Painel';
    els.sub.textContent = view.sub || '';

    document.querySelectorAll('.nav-item').forEach(btn => {
      const active = btn.dataset.route === current;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    els.view.innerHTML = '';
    try {
      view.render(els.view);
    } catch (err) {
      console.error('[render] falha na tela ' + current, err);
      els.view.innerHTML =
        '<div class="card"><div class="empty"><div class="emoji">⚠️</div>' +
        '<h3>Não foi possível montar esta tela</h3>' +
        '<p>' + UI.esc(err.message || 'Erro inesperado') + '</p>' +
        '<button class="btn btn-primary" data-retry>Recarregar dados</button></div></div>';
      const retry = els.view.querySelector('[data-retry]');
      if (retry) retry.addEventListener('click', () => refresh());
    }

    updateCounts();
    bindGlobalControls(els.view);
  }

  function rerender() { render(); }

  function bindGlobalControls(root) {
    root.querySelectorAll('[data-nav]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => navigate(btn.dataset.nav));
    });
    root.querySelectorAll('[data-quick]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        if (btn.dataset.quick === 'manejo') Views.openManejoForm();
      });
    });
  }

  function updateCounts() {
    const counts = {
      lotes: Analytics.lotesAtivos().length,
      matrizes: Analytics.matrizesAtivas().length
    };
    document.querySelectorAll('[data-count]').forEach(el => {
      const v = counts[el.dataset.count];
      el.textContent = v === undefined ? '0' : String(v);
      el.style.display = v ? '' : 'none';
    });

    const total = API.TABLES.reduce((s, t) => s + (API.state[t] || []).length, 0);
    if (els.footStatus) {
      if (API.state.errors.length) {
        els.footStatus.textContent = '⚠️ ' + total + ' registro(s) · ' + API.state.errors.length + ' tabela(s) indisponível(is)';
      } else {
        els.footStatus.textContent = '✅ ' + total + ' registro(s) salvo(s) neste aparelho';
      }
    }
  }

  /* ---------------- Sidebar mobile ---------------- */

  function openNav() {
    if (!els.sidebar) return;
    els.sidebar.classList.add('open');
    if (els.scrimNav) { els.scrimNav.hidden = false; els.scrimNav.classList.add('show'); }
    if (els.hamburger) els.hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeNav() {
    if (!els.sidebar) return;
    els.sidebar.classList.remove('open');
    if (els.scrimNav) { els.scrimNav.classList.remove('show'); els.scrimNav.hidden = true; }
    if (els.hamburger) els.hamburger.setAttribute('aria-expanded', 'false');
  }

  /* ---------------- Configurações ---------------- */

  function applySettings(cfg) {
    if (els.brandName) els.brandName.textContent = (cfg && cfg.nomeGranja) || 'Minha Granja';
    document.title = ((cfg && cfg.nomeGranja) || 'Granja Suína') + ' — Gestão';
  }

  /* ---------------- Dados ---------------- */

  async function refresh(withToast) {
    if (els.footStatus) els.footStatus.textContent = 'Sincronizando…';
    await API.loadAll();
    updateCounts();
    render();
    if (withToast) {
      const total = API.TABLES.reduce((s, t) => s + (API.state[t] || []).length, 0);
      UI.toast('Dados atualizados (' + total + ' registros)', 'ok');
    }
  }

  /* ---------------- Inicialização ---------------- */

  function boot() {
    cacheEls();
    Views.setupChartDefaults();
    applySettings(Settings.read());

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.route));
    });

    if (els.hamburger) els.hamburger.addEventListener('click', () => {
      if (els.sidebar.classList.contains('open')) closeNav(); else openNav();
    });
    if (els.scrimNav) els.scrimNav.addEventListener('click', closeNav);

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', () => refresh(true));

    const btnManejo = document.getElementById('btn-quick-manejo');
    if (btnManejo) btnManejo.addEventListener('click', () => Views.openManejoForm());

    window.addEventListener('hashchange', () => {
      const r = routeFromHash();
      if (r && r !== current) { current = r; render(); }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && UI.openModal) UI.closeModal();
    });

    // Navegação por atalho numérico (desktop)
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (UI.openModal) return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= 9) navigate(ROUTES[idx - 1]);
    });

    const forced = window.__forceRoute;
    const initial = (forced && ROUTES.indexOf(forced) >= 0) ? forced : (routeFromHash() || 'painel');
    current = initial;
    if (location.hash !== '#/' + initial) history.replaceState(null, '', '#/' + initial);

    API.on(() => { updateCounts(); });
    refresh(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return { navigate, render, rerender, refresh, applySettings, get current() { return current; } };
})();
