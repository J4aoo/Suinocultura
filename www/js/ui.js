/* ==========================================================================
   ui.js — utilidades de interface: formatação, toasts, modais e formulários
   ========================================================================== */
const UI = (function () {
  'use strict';

  /* ---------- Formatação ---------- */

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const num1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function money(v) {
    const n = toNum(v);
    return brl.format(isFinite(n) ? n : 0);
  }
  function int(v) { return num.format(Math.round(toNum(v))); }
  function dec(v, digits) { return (digits === 2 ? num2 : num1).format(toNum(v)); }
  function pct(v, digits) {
    const n = toNum(v);
    if (!isFinite(n)) return '—';
    return (digits === 0 ? n.toFixed(0) : n.toFixed(1)).replace('.', ',') + '%';
  }
  function kg(v) { return dec(v, 1) + ' kg'; }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? NaN : n;
  }
  function n0(v) { const n = toNum(v); return isFinite(n) ? n : 0; }

  /** Aceita 'AAAA-MM-DD' ou timestamp em ms e devolve Date local (sem fuso). */
  function toDate(v) {
    if (!v) return null;
    if (typeof v === 'number') return new Date(v);
    if (typeof v === 'object' && v instanceof Date) return isNaN(v) ? null : v;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const p = s.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]);
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function fmtDate(v) {
    const d = toDate(v);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtDateShort(v) {
    const d = toDate(v);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  /** Valor para <input type="date"> */
  function dateInput(v) {
    const d = toDate(v);
    if (!d) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function today() { return dateInput(new Date()); }

  function daysBetween(a, b) {
    const d1 = toDate(a), d2 = toDate(b);
    if (!d1 || !d2) return NaN;
    return Math.round((d2 - d1) / 86400000);
  }
  function daysAgo(v) {
    const n = daysBetween(v, new Date());
    return isFinite(n) ? n : NaN;
  }
  function addDays(v, days) {
    const d = toDate(v);
    if (!d) return null;
    const out = new Date(d.getTime());
    out.setDate(out.getDate() + days);
    return out;
  }

  function relative(v) {
    const n = daysAgo(v);
    if (!isFinite(n)) return '—';
    if (n === 0) return 'hoje';
    if (n === 1) return 'ontem';
    if (n < 0) return 'em ' + Math.abs(n) + ' dias';
    if (n < 30) return 'há ' + n + ' dias';
    if (n < 365) return 'há ' + Math.round(n / 30) + ' meses';
    return 'há ' + Math.floor(n / 365) + ' ano(s)';
  }

  /* ---------- Texto seguro ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Toasts ---------- */
  function toast(message, kind) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.innerHTML = '<span aria-hidden="true">' + (kind === 'err' ? '⚠️' : kind === 'ok' ? '✅' : 'ℹ️') + '</span><span>' + esc(message) + '</span>';
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, kind === 'err' ? 5200 : 3000);
  }

  /* ---------- Modal ---------- */
  let openModal = null;

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    openModal = null;
    document.body.style.overflow = '';
  }

  function modal(options) {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const wide = options.wide ? ' wide' : '';
    root.innerHTML =
      '<div class="scrim" data-scrim>' +
        '<div class="modal' + wide + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
          '<div class="modal-head">' +
            '<div>' +
              '<h2 id="modal-title">' + esc(options.title || '') + '</h2>' +
              (options.subtitle ? '<p>' + esc(options.subtitle) + '</p>' : '') +
            '</div>' +
            '<button class="btn btn-ghost btn-icon x" data-close aria-label="Fechar">✕</button>' +
          '</div>' +
          '<div class="modal-body">' + (options.body || '') + '</div>' +
          (options.footer ? '<div class="modal-foot">' + options.footer + '</div>' : '') +
        '</div>' +
      '</div>';

    document.body.style.overflow = 'hidden';
    openModal = root.firstElementChild;

    root.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModal));
    root.querySelector('[data-scrim]').addEventListener('mousedown', (e) => {
      if (e.target.hasAttribute('data-scrim')) closeModal();
    });
    const first = root.querySelector('.modal-body input:not([type=hidden]), .modal-body select, .modal-body textarea');
    if (first && window.innerWidth > 700) setTimeout(() => { try { first.focus(); } catch (_) {} }, 60);
    return openModal;
  }

  function confirmDialog(title, message, confirmLabel, danger) {
    return new Promise((resolve) => {
      modal({
        title: title,
        body: '<p style="margin:0;color:var(--ink-700);font-size:14px">' + esc(message) + '</p>',
        footer:
          '<button class="btn" data-no>Cancelar</button>' +
          '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' + esc(confirmLabel || 'Confirmar') + '</button>'
      });
      const root = document.getElementById('modal-root');
      root.querySelector('[data-no]').addEventListener('click', () => { closeModal(); resolve(false); });
      root.querySelector('[data-yes]').addEventListener('click', () => { closeModal(); resolve(true); });
    });
  }

  /* ---------- Construção de formulários ----------
     field: { name, label, type, required, options, value, help, full, min, step, placeholder }
     type: text | number | date | select | textarea | checkbox
  */
  function fieldHtml(f) {
    const id = 'f_' + f.name;
    const full = f.full ? ' full' : '';
    const req = f.required ? ' required' : '';
    let control;

    if (f.type === 'select') {
      const opts = ['<option value="">Selecione…</option>'].concat(
        (f.options || []).map(o => {
          const val = typeof o === 'object' ? o.value : o;
          const lbl = typeof o === 'object' ? o.label : o;
          const sel = String(val) === String(f.value === undefined || f.value === null ? '' : f.value) ? ' selected' : '';
          return '<option value="' + esc(val) + '"' + sel + '>' + esc(lbl) + '</option>';
        })
      ).join('');
      control = '<select id="' + id + '" name="' + f.name + '"' + req + '>' + opts + '</select>';
    } else if (f.type === 'textarea') {
      control = '<textarea id="' + id + '" name="' + f.name + '"' + req + ' placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
    } else if (f.type === 'checkbox') {
      return '<div class="field' + full + '">' +
        '<label style="display:flex;gap:8px;align-items:center;font-weight:600">' +
        '<input type="checkbox" id="' + id + '" name="' + f.name + '"' + (f.value ? ' checked' : '') + ' style="width:auto"> ' +
        esc(f.label) + '</label></div>';
    } else {
      const type = f.type || 'text';
      const step = f.step ? ' step="' + f.step + '"' : (type === 'number' ? ' step="any"' : '');
      const min = f.min !== undefined ? ' min="' + f.min + '"' : '';
      control = '<input type="' + type + '" id="' + id + '" name="' + f.name + '" value="' + esc(f.value === null || f.value === undefined ? '' : f.value) + '"' +
        step + min + req + ' placeholder="' + esc(f.placeholder || '') + '"' + (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + '>';
    }

    return '<div class="field' + full + '">' +
      '<label for="' + id + '">' + esc(f.label) + (f.required ? ' <span class="req">*</span>' : '') + '</label>' +
      control +
      (f.help ? '<span class="help">' + esc(f.help) + '</span>' : '') +
      '</div>';
  }

  function formHtml(fields) {
    return '<form class="form-grid" id="entity-form" novalidate>' + fields.map(fieldHtml).join('') + '</form>';
  }

  /** Lê os campos do formulário e devolve objeto já convertido por tipo. */
  function readForm(fields) {
    const form = document.getElementById('entity-form');
    const out = {};
    const missing = [];

    fields.forEach(f => {
      const el = form.querySelector('[name="' + f.name + '"]');
      if (!el) return;
      let value;
      if (f.type === 'checkbox') value = el.checked;
      else if (f.type === 'number') {
        const raw = el.value.trim();
        value = raw === '' ? null : toNum(raw);
        if (value !== null && !isFinite(value)) value = null;
      } else {
        value = el.value.trim();
        if (value === '') value = null;
      }
      if (f.required && (value === null || value === '')) missing.push(f.label);
      out[f.name] = value;
    });

    return { data: out, missing };
  }

  /** Modal de formulário genérico. options: { title, subtitle, fields, submitLabel, onSubmit } */
  function formModal(options) {
    const body = formHtml(options.fields);
    modal({
      title: options.title,
      subtitle: options.subtitle,
      wide: options.wide,
      body: body,
      footer:
        (options.footerLeft || '') +
        '<button class="btn" data-close>Cancelar</button>' +
        '<button class="btn btn-primary" data-submit>' + esc(options.submitLabel || 'Salvar') + '</button>'
    });

    const root = document.getElementById('modal-root');
    const form = root.querySelector('#entity-form');
    const submitBtn = root.querySelector('[data-submit]');

    async function doSubmit() {
      const { data, missing } = readForm(options.fields);
      if (missing.length) {
        toast('Preencha: ' + missing.join(', '), 'err');
        return;
      }
      submitBtn.disabled = true;
      const original = submitBtn.textContent;
      submitBtn.textContent = 'Salvando…';
      try {
        await options.onSubmit(data, { form, close: closeModal });
      } catch (err) {
        console.error(err);
        toast('Não foi possível salvar: ' + (err.message || 'erro desconhecido'), 'err');
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      }
    }

    submitBtn.addEventListener('click', doSubmit);
    form.addEventListener('submit', (e) => { e.preventDefault(); doSubmit(); });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); doSubmit(); }
    });
    return { form, close: closeModal };
  }

  /* ---------- Diversos ---------- */
  function emptyState(emoji, title, text, actionHtml) {
    return '<div class="empty"><div class="emoji">' + emoji + '</div><h3>' + esc(title) + '</h3>' +
      '<p>' + esc(text) + '</p>' + (actionHtml || '') + '</div>';
  }

  function badge(text, kind) {
    return '<span class="badge badge-' + (kind || 'gray') + '">' + esc(text) + '</span>';
  }

  function appNativo() {
    const C = window.Capacitor;
    return !!(C && C.isNativePlatform && C.isNativePlatform());
  }

  /** No app Android: grava o arquivo e abre o "Compartilhar" (WhatsApp, Drive, e-mail…). */
  async function compartilharArquivo(filename, content) {
    const P = window.Capacitor.Plugins;
    const res = await P.Filesystem.writeFile({ path: filename, data: content, directory: 'CACHE', encoding: 'utf8' });
    try {
      await P.Share.share({ title: filename, text: filename, url: res.uri, dialogTitle: 'Salvar ou enviar ' + filename });
    } catch (e) {
      // O usuário fechar a tela de compartilhar não é erro.
      if (!/cancel/i.test((e && e.message) || '')) throw e;
    }
  }

  function download(filename, content, mime) {
    if (appNativo() && window.Capacitor.Plugins.Filesystem && window.Capacitor.Plugins.Share) {
      compartilharArquivo(filename, content).catch(err => {
        console.error('[download]', err);
        toast('Não foi possível gerar o arquivo: ' + ((err && err.message) || err), 'err');
      });
      return;
    }
    const blob = new Blob([content], { type: (mime || 'text/csv') + ';charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function toCsv(rows, headers) {
    const sep = ';';
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = headers.map(h => cell(h.label)).join(sep);
    const body = rows.map(r => headers.map(h => cell(typeof h.value === 'function' ? h.value(r) : r[h.key])).join(sep)).join('\r\n');
    return '\ufeff' + head + '\r\n' + body;
  }

  return {
    money, int, dec, pct, kg, toNum, n0, toDate, fmtDate, fmtDateShort, dateInput, today,
    daysBetween, daysAgo, addDays, relative, esc, toast, modal, closeModal, confirmDialog,
    formModal, formHtml, emptyState, badge, download, toCsv, appNativo, get openModal() { return openModal; }
  };
})();
