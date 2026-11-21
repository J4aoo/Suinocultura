/* ==========================================================================
   analytics.js — indicadores zootécnicos e financeiros
   ========================================================================== */
const Settings = (function () {
  'use strict';
  const KEY = 'granja.settings.v1';
  const defaults = {
    nomeGranja: 'Minha Granja',
    metaCA: 2.8,
    limiteMortalidade: 4,
    diasSemManejo: 3,
    alertaValidade: 30,
    custoRacaoKg: 2.1
  };

  function read() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { stored = {}; }
    return Object.assign({}, defaults, stored);
  }
  function write(patch) {
    const next = Object.assign({}, read(), patch || {});
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (_) {}
    return Object.assign({}, defaults);
  }
  return { read, write, reset, defaults };
})();

const Analytics = (function () {
  'use strict';

  const A = {};

  function rows(name) { return API.state[name] || []; }

  /* ---------------- Lotes ---------------- */

  A.loteMetrics = function (lote) {
    const qIni = UI.n0(lote.quantidade_inicial);
    const mortes = UI.n0(lote.mortes);
    const qAt = lote.quantidade_atual === null || lote.quantidade_atual === undefined || lote.quantidade_atual === ''
      ? Math.max(qIni - mortes, 0)
      : UI.n0(lote.quantidade_atual);

    const dias = Math.max(UI.daysBetween(lote.data_entrada, new Date()) || 0, 0);
    const pesoE = UI.n0(lote.peso_entrada);
    const pesoA = UI.n0(lote.peso_atual);
    const ganhoCab = pesoA > 0 && pesoE > 0 ? pesoA - pesoE : NaN;
    const gpd = dias > 0 && isFinite(ganhoCab) ? ganhoCab / dias : NaN;

    const ganhoTotalKg = isFinite(ganhoCab) ? Math.max(ganhoCab, 0) * qAt : NaN;
    const racao = UI.n0(lote.racao_consumida);
    const ca = isFinite(ganhoTotalKg) && ganhoTotalKg > 0 && racao > 0 ? racao / ganhoTotalKg : NaN;

    const custo = UI.n0(lote.custo_acumulado);
    const custoCab = qAt > 0 ? custo / qAt : NaN;
    const custoKg = isFinite(ganhoTotalKg) && ganhoTotalKg > 0 && custo > 0 ? custo / ganhoTotalKg : NaN;

    return {
      qIni, qAt, mortes,
      mortalidade: qIni > 0 ? (mortes / qIni) * 100 : NaN,
      dias,
      pesoE, pesoA,
      pesoTotal: pesoA > 0 ? pesoA * qAt : NaN,
      ganhoCab, gpd,
      ganhoTotalKg,
      racao,
      consumoPorCabDia: dias > 0 && qAt > 0 && racao > 0 ? racao / (dias * qAt) : NaN,
      racaoPorCab: qAt > 0 && racao > 0 ? racao / qAt : NaN,
      ca,
      custo, custoCab, custoKg
    };
  };

  A.lotesAtivos = function () {
    return rows('lotes').filter(l => l.status !== 'Encerrado' && l.status !== 'Vendido');
  };

  A.totais = function () {
    const ativos = A.lotesAtivos();
    const m = ativos.map(A.loteMetrics);
    const animais = m.reduce((s, x) => s + x.qAt, 0);
    const pesoVivo = m.reduce((s, x) => s + (isFinite(x.pesoTotal) ? x.pesoTotal : 0), 0);
    const qIni = m.reduce((s, x) => s + x.qIni, 0);
    const mortes = m.reduce((s, x) => s + x.mortes, 0);
    const custo = m.reduce((s, x) => s + x.custo, 0);
    return {
      animais,
      pesoVivo,
      lotesAtivos: ativos.length,
      mortalidade: qIni > 0 ? (mortes / qIni) * 100 : NaN,
      custo
    };
  };

  /** Animais por fase (apenas lotes ativos). */
  A.porFase = function () {
    const fases = ['Maternidade', 'Creche', 'Crescimento', 'Terminação', 'Reprodução'];
    const out = {};
    fases.forEach(f => { out[f] = 0; });
    A.lotesAtivos().forEach(l => {
      const f = l.fase || 'Outros';
      out[f] = (out[f] || 0) + UI.n0(l.quantidade_atual);
    });
    return out;
  };

  /* ---------------- Reprodução ---------------- */

  A.matrizesAtivas = function () {
    return rows('matrizes').filter(m => m.status !== 'Descartada');
  };

  A.repro = function () {
    const ativas = A.matrizesAtivas();
    const porFase = { Vazia: 0, Coberta: 0, Gestante: 0, Lactante: 0, Descarte: 0 };
    ativas.forEach(m => { const f = m.fase || 'Vazia'; porFase[f] = (porFase[f] || 0) + 1; });

    const ps = rows('partos');
    const totPartos = ps.length;
    const nascidos = ps.reduce((s, p) => s + UI.n0(p.nascidos), 0);
    const vivos = ps.reduce((s, p) => s + UI.n0(p.nascidos_vivos), 0);
    const natimortos = ps.reduce((s, p) => s + UI.n0(p.natimortos), 0);
    const mumificados = ps.reduce((s, p) => s + UI.n0(p.mumificados), 0);
    const desmamados = ps.reduce((s, p) => s + UI.n0(p.desmamados), 0);

    const comDesmame = ps.filter(p => UI.n0(p.desmamados) > 0);
    const taxaDesmame = vivos > 0 ? (desmamados / vivos) * 100 : NaN;

    // Período coberto pelos partos, em meses
    const datas = ps.map(p => UI.toDate(p.data)).filter(Boolean).sort((a, b) => a - b);
    let meses = 0;
    if (datas.length > 1) {
      meses = (datas[datas.length - 1] - datas[0]) / (1000 * 60 * 60 * 24 * 30.44);
    }
    const desmamadosPorMatrizAno = (ativas.length > 0 && meses >= 1)
      ? (desmamados / meses) * 12 / ativas.length
      : NaN;

    return {
      ativas: ativas.length,
      porFase,
      totPartos,
      mediaNascidos: totPartos ? nascidos / totPartos : NaN,
      mediaVivos: totPartos ? vivos / totPartos : NaN,
      mediaDesmamados: comDesmame.length ? desmamados / comDesmame.length : NaN,
      taxaDesmame,
      natimortos,
      mumificados,
      desmamados,
      desmamadosPorMatrizAno
    };
  };

  /** Partos previstos nos próximos N dias (e atrasados). */
  A.partosPrevistos = function (dias) {
    const limite = dias || 15;
    return A.matrizesAtivas()
      .filter(m => m.data_parto_previsto)
      .map(m => {
        const d = UI.daysBetween(new Date(), m.data_parto_previsto);
        return { matriz: m, dias: d };
      })
      .filter(x => isFinite(x.dias) && x.dias <= limite)
      .sort((a, b) => a.dias - b.dias);
  };

  /* ---------------- Financeiro ---------------- */

  A.finSummary = function (list) {
    let receita = 0, despesa = 0;
    const porCategoria = {};
    const porMes = {};

    (list || []).forEach(f => {
      const v = UI.n0(f.valor);
      const cat = f.categoria || 'Outros';
      if (f.tipo === 'Receita') receita += v; else despesa += v;

      if (!porCategoria[cat]) porCategoria[cat] = { receita: 0, despesa: 0 };
      if (f.tipo === 'Receita') porCategoria[cat].receita += v;
      else porCategoria[cat].despesa += v;

      const d = UI.toDate(f.data);
      if (d) {
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!porMes[key]) porMes[key] = { receita: 0, despesa: 0 };
        if (f.tipo === 'Receita') porMes[key].receita += v;
        else porMes[key].despesa += v;
      }
    });

    return { receita, despesa, saldo: receita - despesa, porCategoria, porMes, count: (list || []).length };
  };

  A.finPeriodo = function (dias) {
    const limite = UI.addDays(new Date(), -dias);
    const list = rows('financeiro').filter(f => {
      const d = UI.toDate(f.data);
      return d && limite && d >= limite;
    });
    return A.finSummary(list);
  };

  /** Série mensal dos últimos N meses, para gráficos. */
  A.serieMensal = function (meses) {
    const n = meses || 6;
    const labels = [];
    const receitas = [];
    const despesas = [];
    const now = new Date();

    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      labels.push(d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(d.getFullYear()).slice(2));

      let r = 0, p = 0;
      rows('financeiro').forEach(f => {
        const fd = UI.toDate(f.data);
        if (!fd) return;
        const k = fd.getFullYear() + '-' + String(fd.getMonth() + 1).padStart(2, '0');
        if (k !== key) return;
        if (f.tipo === 'Receita') r += UI.n0(f.valor); else p += UI.n0(f.valor);
      });
      receitas.push(r);
      despesas.push(p);
    }
    return { labels, receitas, despesas };
  };

  /* ---------------- Estoque ---------------- */

  A.estoqueResumo = function () {
    const itens = rows('estoque');
    const cfg = Settings.read();
    let valor = 0, baixos = 0, vencendo = 0, vencidos = 0;
    const detalhe = itens.map(it => {
      const q = UI.n0(it.quantidade);
      const min = UI.n0(it.estoque_minimo);
      const cu = UI.n0(it.custo_unitario);
      valor += q * cu;
      const baixo = min > 0 && q <= min;
      if (baixo) baixos++;
      const dv = it.validade ? UI.daysBetween(new Date(), it.validade) : NaN;
      let statusVal = 'ok';
      if (isFinite(dv)) {
        if (dv < 0) { statusVal = 'vencido'; vencidos++; }
        else if (dv <= cfg.alertaValidade) { statusVal = 'vencendo'; vencendo++; }
      }
      return { item: it, q, min, cu, baixo, diasValidade: dv, statusVal, valorTotal: q * cu };
    });
    return { itens, valor, baixos, vencendo, vencidos, detalhe };
  };

  /* ---------------- Alertas ---------------- */

  A.alertas = function () {
    const cfg = Settings.read();
    const out = [];

    // Estoque baixo
    A.estoqueResumo().detalhe.forEach(d => {
      if (d.baixo) {
        out.push({
          level: d.q === 0 ? 'danger' : 'warn',
          icon: d.q === 0 ? '🚨' : '📦',
          title: d.item.produto + (d.q === 0 ? ' — sem estoque' : ' — estoque baixo'),
          text: 'Restam ' + UI.dec(d.q) + ' ' + (d.item.unidade || 'un') + ' (mínimo ' + UI.dec(d.min) + ').'
        });
      }
      if (d.statusVal === 'vencido') {
        out.push({ level: 'danger', icon: '⛔', title: d.item.produto + ' vencido', text: 'Validade em ' + UI.fmtDate(d.item.validade) + '. Não utilize.' });
      } else if (d.statusVal === 'vencendo') {
        out.push({ level: 'warn', icon: '⏳', title: d.item.produto + ' a vencer', text: 'Vence em ' + UI.fmtDate(d.item.validade) + ' (' + d.diasValidade + ' dias).' });
      }
    });

    // Partos atrasados / próximos
    A.partosPrevistos(30).forEach(x => {
      const brinco = x.matriz.brinco || x.matriz.nome || 'Matriz';
      if (x.dias < 0) {
        out.push({ level: 'danger', icon: '🍼', title: 'Parto atrasado — ' + brinco, text: 'Previsão era ' + UI.fmtDate(x.matriz.data_parto_previsto) + ' (' + Math.abs(x.dias) + ' dias).' });
      } else if (x.dias <= 7) {
        out.push({ level: 'warn', icon: '🍼', title: 'Parto próximo — ' + brinco, text: 'Previsão em ' + x.dias + ' dia(s), ' + UI.fmtDate(x.matriz.data_parto_previsto) + '.' });
      }
    });

    // Mortalidade acima do limite
    A.lotesAtivos().forEach(l => {
      const m = A.loteMetrics(l);
      if (isFinite(m.mortalidade) && m.mortalidade > cfg.limiteMortalidade && m.qIni >= 10) {
        out.push({
          level: 'warn', icon: '📉',
          title: 'Mortalidade alta — ' + (l.codigo || 'lote'),
          text: UI.pct(m.mortalidade) + ' de ' + UI.int(m.qIni) + ' animais (limite ' + UI.dec(cfg.limiteMortalidade) + '%).'
        });
      }
    });

    // Lotes sem manejo registrado recentemente
    const ultimoPorLote = {};
    rows('manejos').forEach(mg => {
      const d = UI.toDate(mg.data);
      if (!d || !mg.lote_id) return;
      if (!ultimoPorLote[mg.lote_id] || d > ultimoPorLote[mg.lote_id]) ultimoPorLote[mg.lote_id] = d;
    });
    A.lotesAtivos().forEach(l => {
      const ult = ultimoPorLote[l.id];
      if (!ult) return;
      const dias = UI.daysBetween(ult, new Date());
      if (isFinite(dias) && dias > cfg.diasSemManejo) {
        out.push({ level: 'info', icon: '📝', title: 'Sem registro de manejo — ' + (l.codigo || 'lote'), text: 'Último manejo há ' + dias + ' dias.' });
      }
    });

    const ordem = { danger: 0, warn: 1, info: 2 };
    out.sort((a, b) => (ordem[a.level] || 3) - (ordem[b.level] || 3));
    return out;
  };

  /* ---------------- Últimos manejos ---------------- */

  A.ultimosManejos = function (n) {
    return rows('manejos')
      .filter(m => m.data)
      .sort((a, b) => (UI.toDate(b.data) || 0) - (UI.toDate(a.data) || 0))
      .slice(0, n || 6);
  };

  A.loteNome = function (id) {
    const l = API.byId('lotes', id);
    return l ? (l.codigo || 'Lote') : '—';
  };

  return A;
})();
