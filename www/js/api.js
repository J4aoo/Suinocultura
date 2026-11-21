/* ==========================================================================
   api.js — camada de dados (salva no próprio aparelho)
   Mesma interface da Table API original; dados em SQLite (Android) ou localStorage (navegador).
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

  /* ------------------------------------------------------------------
     Armazenamento no próprio aparelho.
     - No app Android: banco SQLite (plugin @capacitor-community/sqlite).
     - No navegador (testes): localStorage.
     As duas opções têm a mesma interface: all / insert / replace / remove.
     Use Ajustes → Backup para exportar e guardar uma cópia dos dados.
     ------------------------------------------------------------------ */
  function saveError(e) {
    const err = new Error('Não foi possível salvar no aparelho: ' + ((e && e.message) || e));
    err.status = 507;
    return err;
  }

  const LocalStore = {
    nome: 'navegador',
    KEY: 'granja.db.',
    async init() {},
    read(t) {
      try { return JSON.parse(localStorage.getItem(this.KEY + t) || '[]'); } catch (_) { return []; }
    },
    write(t, rows) {
      try { localStorage.setItem(this.KEY + t, JSON.stringify(rows)); } catch (e) { throw saveError(e); }
    },
    async all(t) { return this.read(t); },
    async insert(t, row) { const rows = this.read(t); rows.push(row); this.write(t, rows); },
    async replace(t, row) {
      const rows = this.read(t);
      const i = rows.findIndex(r => r.id === row.id);
      if (i >= 0) rows[i] = row; else rows.push(row);
      this.write(t, rows);
    },
    async remove(t, id) { this.write(t, this.read(t).filter(r => r.id !== id)); }
  };

  const SqliteStore = {
    nome: 'SQLite',
    DB: 'granja',
    p: null,
    async init() {
      this.p = window.Capacitor.Plugins.CapacitorSQLite;
      const db = this.DB;
      // Ao recarregar a tela a conexão nativa pode continuar aberta.
      try { await this.p.closeConnection({ database: db, readonly: false }); } catch (_) { /* não havia conexão */ }
      await this.p.createConnection({ database: db, version: 1, encrypted: false, mode: 'no-encryption', readonly: false });
      await this.p.open({ database: db, readonly: false });
      await this.p.execute({
        database: db, readonly: false, transaction: true,
        statements:
          'CREATE TABLE IF NOT EXISTS registros (' +
          ' tabela TEXT NOT NULL, id TEXT NOT NULL, dados TEXT NOT NULL,' +
          ' criado INTEGER, atualizado INTEGER, PRIMARY KEY (tabela, id));' +
          'CREATE INDEX IF NOT EXISTS idx_registros_tabela ON registros (tabela, criado);'
      });
    },
    async all(t) {
      const r = await this.p.query({
        database: this.DB, readonly: false,
        statement: 'SELECT dados FROM registros WHERE tabela = ? ORDER BY criado, rowid',
        values: [t]
      });
      return ((r && r.values) || []).map(v => { try { return JSON.parse(v.dados); } catch (_) { return null; } }).filter(Boolean);
    },
    async run(sql, values) {
      try { await this.p.run({ database: this.DB, readonly: false, transaction: true, statement: sql, values: values }); }
      catch (e) { throw saveError(e); }
    },
    insert(t, row) { return this.replace(t, row); },
    replace(t, row) {
      return this.run(
        'INSERT OR REPLACE INTO registros (tabela, id, dados, criado, atualizado) VALUES (?, ?, ?, ?, ?)',
        [t, row.id, JSON.stringify(row), row.created_at || Date.now(), row.updated_at || Date.now()]
      );
    },
    remove(t, id) { return this.run('DELETE FROM registros WHERE tabela = ? AND id = ?', [t, id]); }
  };

  function ehAppNativo() {
    const C = window.Capacitor;
    return !!(C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.CapacitorSQLite);
  }

  let store = null;
  let storeReady = null;
  function getStore() {
    if (!storeReady) {
      storeReady = (async () => {
        if (ehAppNativo()) {
          try { await SqliteStore.init(); store = SqliteStore; return store; }
          catch (e) { console.error('[api] SQLite indisponível, usando armazenamento do navegador', e); }
        }
        await LocalStore.init();
        store = LocalStore;
        return store;
      })();
    }
    return storeReady;
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function notFound() { const e = new Error('HTTP 404 — registro não encontrado'); e.status = 404; return e; }

  async function request(url, options) {
    const method = ((options && options.method) || 'GET').toUpperCase();
    const body = options && options.body ? JSON.parse(options.body) : null;
    const m = /^tables\/([^/?]+)(?:\/([^?]+))?(?:\?(.*))?$/.exec(url);
    if (!m || TABLES.indexOf(m[1]) < 0) throw notFound();
    const table = m[1];
    const id = m[2] ? decodeURIComponent(m[2]) : null;
    const db = await getStore();
    const rows = await db.all(table);
    const now = Date.now();

    if (method === 'GET' && !id) {
      const q = new URLSearchParams(m[3] || '');
      const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
      const limit = Math.max(1, parseInt(q.get('limit'), 10) || 100);
      return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
    }
    const idx = id ? rows.findIndex(r => r.id === id) : -1;
    if (method === 'GET') { if (idx < 0) throw notFound(); return rows[idx]; }
    if (method === 'POST') {
      const row = Object.assign({}, body, { id: (body && body.id) || newId(), created_at: now, updated_at: now });
      await db.insert(table, row);
      return row;
    }
    if (method === 'PATCH' || method === 'PUT') {
      if (idx < 0) throw notFound();
      const row = Object.assign(method === 'PATCH' ? rows[idx] : { id: id, created_at: rows[idx].created_at }, body, { id: id, updated_at: now });
      await db.replace(table, row);
      return row;
    }
    if (method === 'DELETE') {
      if (idx < 0) throw notFound();
      await db.remove(table, id);
      return null;
    }
    throw notFound();
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
    TABLES, state, loadAll, reload, create, update, remove, save, deleteRow, byId, on,
    get armazenamento() { return store ? store.nome : null; }
  };
})();
