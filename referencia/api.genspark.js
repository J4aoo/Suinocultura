/* ==========================================================================
   api.js — camada de acesso às tabelas (Table API relativa)
   Todas as URLs mantêm o prefixo "tables/" e são relativas à página.
   ========================================================================== */
const API = (function () {
  'use strict';

  const TABLES = ['lotes', 'manejos', 'matrizes', 'partos', 'financeiro', 'estoque'];
  const PAGE = 100;

  const state = {
    lotes: [],
    manejos: [],
    matrizes: [],
    partos: [],
    financeiro: [],
    estoque: [],
    loaded: false,
    errors: []
  };

  const listeners = new Set();

  function on(handler) { listeners.add(handler); }
  function emit(reason) { listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error(e); } }); }

  async function request(url, options) {
    const opts = Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {});
    const res = await fetch(url, opts);
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch (_) { /* ignorado */ }
      const err = new Error('HTTP ' + res.status + (detail ? ' — ' + detail : ''));
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /** Busca todas as linhas de uma tabela, percorrendo as páginas. */
  async function fetchAll(table) {
    const all = [];
    let page = 1;
    let guard = 0;
    while (guard++ < 50) {
      const json = await request('tables/' + table + '?page=' + page + '&limit=' + PAGE);
      const rows = (json && json.data) || [];
      all.push.apply(all, rows);
      const total = json && typeof json.total === 'number' ? json.total : all.length;
      if (rows.length < PAGE || all.length >= total) break;
      page++;
    }
    return all;
  }

  async function loadAll() {
    state.errors = [];
    const results = await Promise.all(TABLES.map(async (t) => {
      try {
        state[t] = await fetchAll(t);
      } catch (err) {
        state[t] = state[t] || [];
        state.errors.push({ table: t, message: err.message });

        // Uma tabela recém-criada pode devolver erro até o primeiro registro;
        // só registramos o problema, sem quebrar a interface.
        console.warn('[api] falha ao carregar ' + t, err);
      }
    }));
    state.loaded = true;
    emit('load');
    return results;
  }

  async function reload(table) {
    if (TABLES.indexOf(table) < 0) return;
    try {
      state[table] = await fetchAll(table);
      emit('reload:' + table);
    } catch (err) {
      console.warn('[api] falha ao recarregar ' + table, err);
    }
  }

  function create(table, data) {
    return request('tables/' + table, { method: 'POST', body: JSON.stringify(data) });
  }
  function update(table, id, data) {
    return request('tables/' + table + '/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) });
  }
  function remove(table, id) {
    return request('tables/' + table + '/' + encodeURIComponent(id), { method: 'DELETE' });
  }

  function byId(table, id) {
    return (state[table] || []).find(r => r.id === id) || null;
  }

  /** Grava e recarrega a tabela afetada. */
  async function save(table, id, data) {
    if (id) {
      const row = await update(table, id, data);
      await reload(table);
      return row;
    }
    const row = await create(table, data);
    await reload(table);
    return row;
  }

  async function deleteRow(table, id) {
    await remove(table, id);
    await reload(table);
  }

  return {
    TABLES, state, loadAll, reload, create, update, remove, save, deleteRow, byId, on
  };
})();
