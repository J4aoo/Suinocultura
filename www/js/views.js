/* ==========================================================================
   views.js — núcleo das telas + Painel, Lotes e Manejo
   ========================================================================== */
const Views = (function () {
  'use strict';

  const reg = {};
  const charts = {};

  function register(name, def) { reg[name] = def; }
  function get(name) { return reg[name]; }

  /* ---------------- Charts ---------------- */

  function setupChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#667a72';
    Chart.defaults.borderColor = '#eef2f0';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,61,43,.94)';
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.maintainAspectRatio = false;
  }

  function destroyCharts() {
    Object.keys(charts).forEach(k => {
      try { charts[k].destroy(); } catch (_) {}
      delete charts[k];
    });
  }

  function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return null;
    try {
      if (charts[id]) { charts[id].destroy(); }
      charts[id] = new Chart(canvas.getContext('2d'), config);
      return charts[id];
    } catch (err) {
      console.warn('[chart] falha ao desenhar ' + id, err);
      return null;
    }
  }

  /* ---------------- Fragmentos reutilizáveis ---------------- */

  function kpi(opts) {
    return '<article class="card kpi">' +
      '<i class="kpi-accent ' + (opts.accent || 'a-green') + '"></i>' +
      '<div class="kpi-label">' + (opts.icon ? '<span aria-hidden="true">' + opts.icon + '</span> ' : '') + UI.esc(opts.label) + '</div>' +
      '<div class="kpi-value">' + opts.value + '</div>' +
      '<div class="kpi-foot">' + (opts.foot || '') + '</div>' +
      '</article>';
  }

  function faseBadge(fase) {
    const map = {
      Maternidade: 'amber', Creche: 'blue', Crescimento: 'green',
      Terminação: 'green', Reprodução: 'blue'
    };
    return UI.badge(fase || '—', map[fase] || 'gray');
  }

  function statusLoteBadge(status) {
    const map = { Ativo: 'green', Encerrado: 'gray', Vendido: 'blue' };
    return UI.badge(status || 'Ativo', map[status] || 'gray');
  }

  function tipoIcone(tipo) {
    const map = {
      'Pesagem': '⚖️', 'Vacinação': '💉', 'Medicação': '💊', 'Desmame': '🍼',
      'Transferência': '🔀', 'Morte': '⚠️', 'Venda': '💵', 'Limpeza/Desinfecção': '🧽',
      'Castração': '✂️', 'Identificação': '🏷️'
    };
    return map[tipo] || '📝';
  }

  function loteOptions(apenasAtivos) {
    const list = apenasAtivos ? Analytics.lotesAtivos() : (API.state.lotes || []);
    return list
      .slice()
      .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || '')))
      .map(l => ({ value: l.id, label: (l.codigo || 'Lote') + (l.fase ? ' · ' + l.fase : '') }));
  }

  function matrizOptions() {
    return Analytics.matrizesAtivas()
      .slice()
      .sort((a, b) => String(a.brinco || '').localeCompare(String(b.brinco || '')))
      .map(m => ({ value: m.id, label: (m.brinco || 'Matriz') + (m.nome ? ' · ' + m.nome : '') }));
  }

  function semDados(titulo, texto) {
    return '<div class="card">' + UI.emptyState('🐖', titulo, texto) + '</div>';
  }

  /* ================= PAINEL ================= */

  register('painel', {
    title: 'Painel',
    sub: 'Visão geral da granja',
    render(el) {
      const cfg = Settings.read();
      const t = Analytics.totais();
      const fin = Analytics.finPeriodo(30);
      const alertas = Analytics.alertas();
      const previstos = Analytics.partosPrevistos(30).slice(0, 5);
      const manejos = Analytics.ultimosManejos(7);
      const repro = Analytics.repro();

      const kpiHtml =
        kpi({
          label: 'Animais alojados', icon: '🐖', accent: 'a-green',
          value: UI.int(t.animais),
          foot: t.lotesAtivos + ' lote(s) ativo(s)'
        }) +
        kpi({
          label: 'Peso vivo estimado', icon: '⚖️', accent: 'a-blue',
          value: t.pesoVivo > 0 ? UI.dec(t.pesoVivo / 1000, 1) + ' <small>t</small>' : '—',
          foot: t.pesoVivo > 0 ? UI.int(t.pesoVivo) + ' kg no total' : 'informe o peso dos lotes'
        }) +
        kpi({
          label: 'Saldo (30 dias)', icon: '💰', accent: fin.saldo >= 0 ? 'a-green' : 'a-red',
          value: '<span class="' + (fin.saldo >= 0 ? 'up' : 'down') + '">' + UI.money(fin.saldo) + '</span>',
          foot: 'Receita ' + UI.money(fin.receita) + ' · Despesa ' + UI.money(fin.despesa)
        }) +
        kpi({
          label: 'Mortalidade acumulada', icon: '📉',
          accent: isFinite(t.mortalidade) && t.mortalidade > cfg.limiteMortalidade ? 'a-red' : 'a-amber',
          value: isFinite(t.mortalidade) ? UI.pct(t.mortalidade) : '—',
          foot: 'Meta: até ' + UI.dec(cfg.limiteMortalidade) + '% · matrizes ativas: ' + repro.ativas
        });

      el.innerHTML =
        '<section class="grid kpis" style="margin-bottom:16px">' + kpiHtml + '</section>' +

        '<section class="grid cols-2-1" style="margin-bottom:16px">' +
          '<div class="card">' +
            '<div class="card-head">' +
              '<div><h2>Receitas e despesas</h2><div class="sub">Últimos 6 meses</div></div>' +
              '<div class="spacer"></div>' +
              '<button class="btn btn-sm" data-nav="financeiro">Ver financeiro</button>' +
            '</div>' +
            '<div class="chart-box"><canvas id="chart-painel-fin"></canvas></div>' +
          '</div>' +

          '<div class="card">' +
            '<div class="card-head">' +
              '<div><h2>Alertas</h2><div class="sub">' + alertas.length + ' ponto(s) de atenção</div></div>' +
            '</div>' +
            '<div class="card-pad">' +
              (alertas.length
                ? '<div class="alert-list">' + alertas.slice(0, 6).map(a =>
                    '<div class="alert-item ' + (a.level === 'danger' ? 'danger' : a.level === 'warn' ? 'warn' : '') + '">' +
                      '<span class="ico" aria-hidden="true">' + a.icon + '</span>' +
                      '<div><strong>' + UI.esc(a.title) + '</strong><span>' + UI.esc(a.text) + '</span></div>' +
                    '</div>').join('') + '</div>' +
                    (alertas.length > 6 ? '<p class="small muted" style="margin:10px 0 0">+ ' + (alertas.length - 6) + ' outro(s) alerta(s).</p>' : '')
                : '<div class="alert-item"><span class="ico" aria-hidden="true">✅</span><div><strong>Tudo em ordem</strong><span>Nenhum alerta no momento.</span></div></div>') +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="grid cols-2">' +
          '<div class="card">' +
            '<div class="card-head">' +
              '<div><h2>Últimos manejos</h2><div class="sub">Registros mais recentes</div></div>' +
              '<div class="spacer"></div>' +
              '<button class="btn btn-sm" data-nav="manejo">Ver todos</button>' +
            '</div>' +
            (manejos.length
              ? '<div class="table-wrap"><table class="data"><thead><tr><th>Data</th><th>Lote</th><th>Manejo</th><th class="num">Animais</th></tr></thead><tbody>' +
                manejos.map(m =>
                  '<tr><td class="nowrap">' + UI.fmtDate(m.data) + '<div class="small muted">' + UI.relative(m.data) + '</div></td>' +
                  '<td class="nowrap">' + UI.esc(Analytics.loteNome(m.lote_id)) + '</td>' +
                  '<td><span aria-hidden="true">' + tipoIcone(m.tipo) + '</span> ' + UI.esc(m.tipo || '—') + '</td>' +
                  '<td class="num">' + (m.quantidade !== null && m.quantidade !== undefined ? UI.int(m.quantidade) : '—') + '</td></tr>').join('') +
                '</tbody></table></div>'
              : UI.emptyState('📝', 'Nenhum manejo registrado', 'Registre pesagens, vacinas e mortes para acompanhar o desempenho.', '<button class="btn btn-primary" data-quick="manejo">Registrar manejo</button>')) +
          '</div>' +

          '<div class="card">' +
            '<div class="card-head">' +
              '<div><h2>Partos previstos</h2><div class="sub">Próximos 30 dias</div></div>' +
              '<div class="spacer"></div>' +
              '<button class="btn btn-sm" data-nav="matrizes">Matrizes</button>' +
            '</div>' +
            (previstos.length
              ? '<div class="table-wrap"><table class="data"><thead><tr><th>Matriz</th><th>Previsão</th><th class="num">Em</th></tr></thead><tbody>' +
                previstos.map(x =>
                  '<tr><td><strong>' + UI.esc(x.matriz.brinco || '—') + '</strong><div class="small muted">' + UI.esc(x.matriz.nome || '') + '</div></td>' +
                  '<td class="nowrap">' + UI.fmtDate(x.matriz.data_parto_previsto) + '</td>' +
                  '<td class="num">' + (x.dias < 0
                    ? UI.badge(Math.abs(x.dias) + 'd atraso', 'red')
                    : UI.badge(x.dias + 'd', x.dias <= 7 ? 'amber' : 'gray')) + '</td></tr>').join('') +
                '</tbody></table></div>'
              : UI.emptyState('🍼', 'Sem partos previstos', 'Cadastre matrizes com data prevista de parto para receber avisos.')) +
          '</div>' +
        '</section>';

      const serie = Analytics.serieMensal(6);
      makeChart('chart-painel-fin', {
        type: 'bar',
        data: {
          labels: serie.labels,
          datasets: [
            { label: 'Receitas', data: serie.receitas, backgroundColor: '#2ea372', borderRadius: 6, maxBarThickness: 30 },
            { label: 'Despesas', data: serie.despesas, backgroundColor: '#e2a24b', borderRadius: 6, maxBarThickness: 30 }
          ]
        },
        options: {
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + (v >= 1000 ? (v / 1000) + 'k' : v) }, grid: { color: '#f0f4f2' } },
            x: { grid: { display: false } }
          },
          plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + UI.money(c.parsed.y) } } }
        }
      });
    }
  });

  /* ================= LOTES ================= */

  const loteFilters = { busca: '', status: 'Ativo' };

  register('lotes', {
    title: 'Lotes',
    sub: 'Animais alojados, desempenho e custos',
    render(el) {
      const todos = (API.state.lotes || []).slice();
      const lista = todos
        .filter(l => loteFilters.status === 'todos' ? true : (l.status || 'Ativo') === loteFilters.status)
        .filter(l => {
          const q = loteFilters.busca.toLowerCase();
          if (!q) return true;
          return [l.codigo, l.fase, l.galpao, l.observacoes].join(' ').toLowerCase().includes(q);
        })
        .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || '')));

      el.innerHTML =
        '<div class="toolbar">' +
          '<label class="search"><span aria-hidden="true">🔍</span><input id="lote-busca" type="search" placeholder="Buscar por código, galpão…" value="' + UI.esc(loteFilters.busca) + '"></label>' +
          '<select class="filter" id="lote-status" aria-label="Filtrar por situação">' +
            ['Ativo', 'Encerrado', 'Vendido', 'todos'].map(s =>
              '<option value="' + s + '"' + (loteFilters.status === s ? ' selected' : '') + '>' + (s === 'todos' ? 'Todas as situações' : s) + '</option>').join('') +
          '</select>' +
          '<div class="grow"></div>' +
          '<button class="btn" id="lote-export">⬇️ Exportar CSV</button>' +
          '<button class="btn btn-primary" id="lote-novo">＋ Novo lote</button>' +
        '</div>' +

        (lista.length
          ? '<div class="grid cols-2">' + lista.map(loteCard).join('') + '</div>'
          : '<div class="card">' + UI.emptyState('🏠', 'Nenhum lote encontrado',
              loteFilters.busca ? 'Ajuste a busca ou o filtro de situação.' : 'Cadastre um lote para começar a acompanhar peso, ração, mortalidade e custo.',
              '<button class="btn btn-primary" data-novo-lote>＋ Criar primeiro lote</button>') + '</div>');

      const busca = el.querySelector('#lote-busca');
      busca.addEventListener('input', () => { loteFilters.busca = busca.value; App.rerender(); });
      el.querySelector('#lote-status').addEventListener('change', (e) => { loteFilters.status = e.target.value; App.rerender(); });
      el.querySelector('#lote-novo').addEventListener('click', () => openLoteForm());
      const altNovo = el.querySelector('[data-novo-lote]');
      if (altNovo) altNovo.addEventListener('click', () => openLoteForm());
      el.querySelector('#lote-export').addEventListener('click', () => exportLotes(lista));

      el.querySelectorAll('[data-lote-edit]').forEach(b => b.addEventListener('click', () => openLoteForm(API.byId('lotes', b.dataset.loteEdit))));
      el.querySelectorAll('[data-lote-manejo]').forEach(b => b.addEventListener('click', () => openManejoForm(null, b.dataset.loteManejo)));
      el.querySelectorAll('[data-lote-del]').forEach(b => b.addEventListener('click', () => confirmDelete('lotes', b.dataset.loteDel, 'lote')));
    }
  });

  function loteCard(l) {
    const m = Analytics.loteMetrics(l);
    const caOk = !isFinite(m.ca) || m.ca <= Settings.read().metaCA;
    const mortOk = !isFinite(m.mortalidade) || m.mortalidade <= Settings.read().limiteMortalidade;

    return '<article class="card lote-card">' +
      '<header>' +
        '<div style="min-width:0">' +
          '<h3>' + UI.esc(l.codigo || 'Lote sem código') + '</h3>' +
          '<div class="small muted">' + UI.esc(l.galpao || 'Galpão não informado') + ' · entrada ' + UI.fmtDate(l.data_entrada) + '</div>' +
        '</div>' +
        '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' +
          faseBadge(l.fase) + statusLoteBadge(l.status) +
        '</div>' +
      '</header>' +

      '<div class="metrics">' +
        '<div class="metric"><div class="l">Animais</div><div class="v">' + UI.int(m.qAt) + '</div></div>' +
        '<div class="metric"><div class="l">Dias</div><div class="v">' + UI.int(m.dias) + '</div></div>' +
        '<div class="metric"><div class="l">Peso médio</div><div class="v">' + (m.pesoA > 0 ? UI.dec(m.pesoA, 1) + ' kg' : '—') + '</div></div>' +
        '<div class="metric"><div class="l">GPD</div><div class="v">' + (isFinite(m.gpd) && m.gpd > 0 ? UI.dec(m.gpd * 1000) + ' g' : '—') + '</div></div>' +
        '<div class="metric"><div class="l">Conv. alimentar</div><div class="v" style="color:' + (caOk ? 'inherit' : 'var(--red-600)') + '">' + (isFinite(m.ca) ? UI.dec(m.ca, 2) : '—') + '</div></div>' +
        '<div class="metric"><div class="l">Mortalidade</div><div class="v" style="color:' + (mortOk ? 'inherit' : 'var(--red-600)') + '">' + (isFinite(m.mortalidade) ? UI.pct(m.mortalidade) : '—') + '</div></div>' +
      '</div>' +

      '<div>' +
        '<div class="row-between small muted" style="margin-bottom:5px"><span>Custo acumulado</span><strong style="color:var(--ink-900)">' + UI.money(m.custo) + '</strong></div>' +
        '<div class="row-between small muted"><span>Custo por cabeça</span><span>' + (isFinite(m.custoCab) ? UI.money(m.custoCab) : '—') + '</span></div>' +
      '</div>' +

      (l.observacoes ? '<p class="small muted" style="margin:0">' + UI.esc(l.observacoes) + '</p>' : '') +

      '<div class="row-actions" style="justify-content:flex-start;flex-wrap:wrap">' +
        '<button class="btn btn-sm btn-primary" data-lote-manejo="' + l.id + '">＋ Manejo</button>' +
        '<button class="btn btn-sm" data-lote-edit="' + l.id + '">Editar</button>' +
        '<button class="btn btn-sm btn-danger" data-lote-del="' + l.id + '">Excluir</button>' +
      '</div>' +
    '</article>';
  }

  function exportLotes(lista) {
    const rows = (lista || API.state.lotes || []).map(l => {
      const m = Analytics.loteMetrics(l);
      return {
        codigo: l.codigo, fase: l.fase, galpao: l.galpao, status: l.status || 'Ativo',
        entrada: UI.dateInput(l.data_entrada), dias: m.dias,
        animais: m.qAt, mortes: m.mortes, mortalidade: isFinite(m.mortalidade) ? m.mortalidade.toFixed(1) : '',
        peso_entrada: m.pesoE || '', peso_atual: m.pesoA || '',
        gpd_g: isFinite(m.gpd) ? (m.gpd * 1000).toFixed(0) : '',
        ca: isFinite(m.ca) ? m.ca.toFixed(2) : '',
        racao_kg: m.racao || '', custo: m.custo || '',
        custo_cabeca: isFinite(m.custoCab) ? m.custoCab.toFixed(2) : ''
      };
    });
    UI.download('lotes-' + UI.today() + '.csv', UI.toCsv(rows, [
      { key: 'codigo', label: 'Lote' }, { key: 'fase', label: 'Fase' }, { key: 'galpao', label: 'Galpão' },
      { key: 'status', label: 'Situação' }, { key: 'entrada', label: 'Entrada' }, { key: 'dias', label: 'Dias' },
      { key: 'animais', label: 'Animais' }, { key: 'mortes', label: 'Mortes' }, { key: 'mortalidade', label: 'Mortalidade %' },
      { key: 'peso_entrada', label: 'Peso entrada (kg)' }, { key: 'peso_atual', label: 'Peso atual (kg)' },
      { key: 'gpd_g', label: 'GPD (g/dia)' }, { key: 'ca', label: 'Conversão alimentar' },
      { key: 'racao_kg', label: 'Ração (kg)' }, { key: 'custo', label: 'Custo (R$)' }, { key: 'custo_cabeca', label: 'Custo/cabeça (R$)' }
    ]));
    UI.toast('CSV de lotes exportado', 'ok');
  }

  function openLoteForm(lote) {
    const edit = !!lote;
    UI.formModal({
      title: edit ? 'Editar lote' : 'Novo lote',
      subtitle: edit ? (lote.codigo || '') : 'Cadastre um novo grupo de animais',
      wide: true,
      fields: [
        { name: 'codigo', label: 'Código do lote', type: 'text', required: true, value: edit ? lote.codigo : sugerirCodigoLote(), placeholder: 'L-2026-01' },
        { name: 'fase', label: 'Fase', type: 'select', required: true, value: edit ? lote.fase : 'Creche', options: ['Maternidade', 'Creche', 'Crescimento', 'Terminação', 'Reprodução'] },
        { name: 'galpao', label: 'Galpão / baia', type: 'text', value: edit ? lote.galpao : '', placeholder: 'Galpão 2 — baia 4' },
        { name: 'data_entrada', label: 'Data de entrada', type: 'date', required: true, value: edit ? UI.dateInput(lote.data_entrada) : UI.today() },
        { name: 'quantidade_inicial', label: 'Animais na entrada', type: 'number', required: true, min: 0, value: edit ? lote.quantidade_inicial : '', inputmode: 'numeric' },
        { name: 'quantidade_atual', label: 'Animais hoje', type: 'number', min: 0, value: edit ? lote.quantidade_atual : '', help: 'Deixe vazio para calcular como entrada − mortes' },
        { name: 'peso_entrada', label: 'Peso médio de entrada (kg)', type: 'number', min: 0, value: edit ? lote.peso_entrada : '' },
        { name: 'peso_atual', label: 'Peso médio atual (kg)', type: 'number', min: 0, value: edit ? lote.peso_atual : '' },
        { name: 'mortes', label: 'Mortes acumuladas', type: 'number', min: 0, value: edit ? lote.mortes : 0 },
        { name: 'racao_consumida', label: 'Ração consumida (kg)', type: 'number', min: 0, value: edit ? lote.racao_consumida : 0 },
        { name: 'custo_acumulado', label: 'Custo acumulado (R$)', type: 'number', min: 0, value: edit ? lote.custo_acumulado : 0 },
        { name: 'status', label: 'Situação', type: 'select', value: edit ? (lote.status || 'Ativo') : 'Ativo', options: ['Ativo', 'Encerrado', 'Vendido'] },
        { name: 'observacoes', label: 'Observações', type: 'textarea', full: true, value: edit ? lote.observacoes : '', placeholder: 'Linhagem, fornecedor dos leitões, particularidades…' }
      ],
      submitLabel: edit ? 'Salvar alterações' : 'Criar lote',
      onSubmit: async (data, ctx) => {
        const payload = Object.assign({}, data);
        if (payload.quantidade_atual === null) delete payload.quantidade_atual;
        await API.save('lotes', edit ? lote.id : null, payload);
        ctx.close();
        UI.toast(edit ? 'Lote atualizado' : 'Lote criado', 'ok');
        App.rerender();
      }
    });
  }

  function sugerirCodigoLote() {
    const ano = new Date().getFullYear();
    const prefixo = 'L-' + ano + '-';
    const nums = (API.state.lotes || [])
      .map(l => String(l.codigo || ''))
      .filter(c => c.indexOf(prefixo) === 0)
      .map(c => parseInt(c.slice(prefixo.length), 10))
      .filter(n => !isNaN(n));
    const proximo = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    return prefixo + String(proximo).padStart(2, '0');
  }

  /* ================= MANEJO ================= */

  const manejoFilters = { busca: '', tipo: '', lote: '' };

  register('manejo', {
    title: 'Manejo',
    sub: 'Pesagens, sanidade, ração e movimentações',
    render(el) {
      const todos = (API.state.manejos || []).slice().sort((a, b) => (UI.toDate(b.data) || 0) - (UI.toDate(a.data) || 0));
      const lista = todos.filter(m => {
        if (manejoFilters.tipo && m.tipo !== manejoFilters.tipo) return false;
        if (manejoFilters.lote && m.lote_id !== manejoFilters.lote) return false;
        const q = manejoFilters.busca.toLowerCase();
        if (q) {
          const alvo = [m.tipo, m.responsavel, m.observacoes, Analytics.loteNome(m.lote_id)].join(' ').toLowerCase();
          if (!alvo.includes(q)) return false;
        }
        return true;
      });

      const custoTotal = lista.reduce((s, m) => s + UI.n0(m.custo), 0);
      const mortes = lista.filter(m => m.tipo === 'Morte').reduce((s, m) => s + UI.n0(m.quantidade), 0);
      const racao = lista.reduce((s, m) => s + UI.n0(m.racao_kg), 0);

      el.innerHTML =
        '<section class="grid kpis" style="margin-bottom:16px">' +
          kpi({ label: 'Registros', icon: '📝', accent: 'a-green', value: UI.int(lista.length), foot: 'no filtro atual' }) +
          kpi({ label: 'Ração fornecida', icon: '🌾', accent: 'a-amber', value: UI.dec(racao / 1000, 1) + ' <small>t</small>', foot: UI.int(racao) + ' kg' }) +
          kpi({ label: 'Mortes registradas', icon: '⚠️', accent: mortes > 0 ? 'a-red' : 'a-green', value: UI.int(mortes), foot: 'no filtro atual' }) +
          kpi({ label: 'Custo dos manejos', icon: '💸', accent: 'a-blue', value: UI.money(custoTotal), foot: 'soma dos registros' }) +
        '</section>' +

        '<div class="toolbar">' +
          '<label class="search"><span aria-hidden="true">🔍</span><input id="mg-busca" type="search" placeholder="Buscar tipo, responsável, observação…" value="' + UI.esc(manejoFilters.busca) + '"></label>' +
          '<select class="filter" id="mg-tipo" aria-label="Filtrar por tipo">' +
            '<option value="">Todos os tipos</option>' +
            ['Pesagem', 'Vacinação', 'Medicação', 'Desmame', 'Transferência', 'Morte', 'Venda', 'Limpeza/Desinfecção', 'Castração', 'Identificação']
              .map(t => '<option value="' + t + '"' + (manejoFilters.tipo === t ? ' selected' : '') + '>' + t + '</option>').join('') +
          '</select>' +
          '<select class="filter" id="mg-lote" aria-label="Filtrar por lote">' +
            '<option value="">Todos os lotes</option>' +
            (API.state.lotes || []).map(l => '<option value="' + l.id + '"' + (manejoFilters.lote === l.id ? ' selected' : '') + '>' + UI.esc(l.codigo || 'Lote') + '</option>').join('') +
          '</select>' +
          '<div class="grow"></div>' +
          '<button class="btn" id="mg-export">⬇️ Exportar CSV</button>' +
          '<button class="btn btn-primary" id="mg-novo">＋ Novo manejo</button>' +
        '</div>' +

        '<div class="card">' +
          (lista.length
            ? '<div class="table-wrap"><table class="data"><thead><tr>' +
              '<th>Data</th><th>Manejo</th><th>Lote</th><th class="num">Animais</th><th class="num">Peso méd.</th>' +
              '<th class="num">Ração</th><th class="num">Custo</th><th>Responsável</th><th></th></tr></thead><tbody>' +
              lista.map(m =>
                '<tr>' +
                '<td class="nowrap">' + UI.fmtDate(m.data) + '<div class="small muted">' + UI.relative(m.data) + '</div></td>' +
                '<td><span aria-hidden="true">' + tipoIcone(m.tipo) + '</span> ' + UI.esc(m.tipo || '—') +
                  (m.observacoes ? '<div class="small muted" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + UI.esc(m.observacoes) + '</div>' : '') + '</td>' +
                '<td class="nowrap">' + UI.esc(Analytics.loteNome(m.lote_id)) + '</td>' +
                '<td class="num">' + (m.quantidade !== null && m.quantidade !== undefined ? UI.int(m.quantidade) : '—') + '</td>' +
                '<td class="num">' + (m.peso_medio ? UI.dec(m.peso_medio, 1) + ' kg' : '—') + '</td>' +
                '<td class="num">' + (m.racao_kg ? UI.dec(m.racao_kg, 1) + ' kg' : '—') + '</td>' +
                '<td class="num">' + (m.custo ? UI.money(m.custo) : '—') + '</td>' +
                '<td class="nowrap small">' + UI.esc(m.responsavel || '—') + '</td>' +
                '<td><div class="row-actions">' +
                  '<button class="btn btn-sm" data-mg-edit="' + m.id + '">Editar</button>' +
                  '<button class="btn btn-sm btn-danger" data-mg-del="' + m.id + '">✕</button>' +
                '</div></td></tr>').join('') +
              '</tbody></table></div>'
            : UI.emptyState('📝', 'Nenhum manejo registrado',
                'Registre pesagens, vacinas, medicações, mortes e vendas para manter o histórico do plantel.',
                '<button class="btn btn-primary" data-novo-mg>＋ Registrar primeiro manejo</button>')) +
        '</div>';

      el.querySelector('#mg-busca').addEventListener('input', (e) => { manejoFilters.busca = e.target.value; App.rerender(); });
      el.querySelector('#mg-tipo').addEventListener('change', (e) => { manejoFilters.tipo = e.target.value; App.rerender(); });
      el.querySelector('#mg-lote').addEventListener('change', (e) => { manejoFilters.lote = e.target.value; App.rerender(); });
      el.querySelector('#mg-novo').addEventListener('click', () => openManejoForm());
      const alt = el.querySelector('[data-novo-mg]');
      if (alt) alt.addEventListener('click', () => openManejoForm());
      el.querySelector('#mg-export').addEventListener('click', () => {
        const rows = lista.map(m => ({
          data: UI.dateInput(m.data), tipo: m.tipo, lote: Analytics.loteNome(m.lote_id),
          quantidade: m.quantidade || '', peso: m.peso_medio || '', racao: m.racao_kg || '',
          custo: m.custo || '', responsavel: m.responsavel || '', obs: m.observacoes || ''
        }));
        UI.download('manejos-' + UI.today() + '.csv', UI.toCsv(rows, [
          { key: 'data', label: 'Data' }, { key: 'tipo', label: 'Manejo' }, { key: 'lote', label: 'Lote' },
          { key: 'quantidade', label: 'Animais' }, { key: 'peso', label: 'Peso médio (kg)' },
          { key: 'racao', label: 'Ração (kg)' }, { key: 'custo', label: 'Custo (R$)' },
          { key: 'responsavel', label: 'Responsável' }, { key: 'obs', label: 'Observações' }
        ]));
        UI.toast('CSV de manejos exportado', 'ok');
      });
      el.querySelectorAll('[data-mg-edit]').forEach(b => b.addEventListener('click', () => openManejoForm(API.byId('manejos', b.dataset.mgEdit))));
      el.querySelectorAll('[data-mg-del]').forEach(b => b.addEventListener('click', () => confirmDelete('manejos', b.dataset.mgDel, 'registro de manejo')));
    }
  });

  function openManejoForm(manejo, loteId) {
    const edit = !!manejo;
    const lotesOpts = loteOptions(!edit);
    if (!lotesOpts.length && !edit) {
      UI.toast('Crie um lote antes de registrar manejos', 'err');
      return;
    }

    UI.formModal({
      title: edit ? 'Editar manejo' : 'Novo manejo',
      subtitle: edit ? 'Ajuste o registro — os totais do lote não são recalculados' : 'O lote pode ser atualizado automaticamente',
      wide: true,
      fields: [
        { name: 'data', label: 'Data', type: 'date', required: true, value: edit ? UI.dateInput(manejo.data) : UI.today() },
        { name: 'tipo', label: 'Tipo de manejo', type: 'select', required: true, value: edit ? manejo.tipo : 'Pesagem',
          options: ['Pesagem', 'Vacinação', 'Medicação', 'Desmame', 'Transferência', 'Morte', 'Venda', 'Limpeza/Desinfecção', 'Castração', 'Identificação'] },
        { name: 'lote_id', label: 'Lote', type: 'select', required: true, value: edit ? manejo.lote_id : (loteId || ''), options: lotesOpts, full: true },
        { name: 'quantidade', label: 'Animais envolvidos', type: 'number', min: 0, value: edit ? manejo.quantidade : '', help: 'Para mortes e vendas, informe quantos animais saíram' },
        { name: 'peso_medio', label: 'Peso médio (kg)', type: 'number', min: 0, value: edit ? manejo.peso_medio : '' },
        { name: 'racao_kg', label: 'Ração fornecida (kg)', type: 'number', min: 0, value: edit ? manejo.racao_kg : '' },
        { name: 'custo', label: 'Custo do manejo (R$)', type: 'number', min: 0, value: edit ? manejo.custo : '' },
        { name: 'responsavel', label: 'Responsável', type: 'text', value: edit ? manejo.responsavel : '', placeholder: 'Nome de quem executou' },
        { name: 'observacoes', label: 'Observações / produto / dose', type: 'textarea', full: true, value: edit ? manejo.observacoes : '', placeholder: 'Ex.: vacina contra circovírus, dose 2 mL, lote do produto…' },
        ...(edit ? [] : [{ name: 'atualizar_lote', label: 'Atualizar automaticamente os totais do lote (animais, peso, ração, custo)', type: 'checkbox', value: true, full: true }])
      ],
      submitLabel: edit ? 'Salvar alterações' : 'Registrar manejo',
      onSubmit: async (data, ctx) => {
        const atualizar = data.atualizar_lote;
        delete data.atualizar_lote;
        const loteAntes = API.byId('lotes', data.lote_id);
        await API.save('manejos', edit ? manejo.id : null, data);

        if (!edit && atualizar && loteAntes) {
          const patch = {};
          const q = UI.n0(data.quantidade);
          const racao = UI.n0(data.racao_kg);
          const custo = UI.n0(data.custo);
          let qAt = loteAntes.quantidade_atual === null || loteAntes.quantidade_atual === undefined || loteAntes.quantidade_atual === ''
            ? UI.n0(loteAntes.quantidade_inicial) - UI.n0(loteAntes.mortes)
            : UI.n0(loteAntes.quantidade_atual);
          let mortes = UI.n0(loteAntes.mortes);
          let mudou = false;

          if (data.tipo === 'Morte' && q > 0) { mortes += q; qAt = Math.max(qAt - q, 0); mudou = true; }
          if (data.tipo === 'Venda' && q > 0) { qAt = Math.max(qAt - q, 0); mudou = true; }
          if (data.tipo === 'Pesagem' && UI.n0(data.peso_medio) > 0) { patch.peso_atual = UI.n0(data.peso_medio); mudou = true; }
          if (racao > 0) { patch.racao_consumida = UI.n0(loteAntes.racao_consumida) + racao; mudou = true; }
          if (custo > 0) { patch.custo_acumulado = UI.n0(loteAntes.custo_acumulado) + custo; mudou = true; }
          if (data.tipo === 'Morte' || data.tipo === 'Venda') {
            patch.quantidade_atual = qAt;
            patch.mortes = mortes;
            if (qAt === 0) patch.status = data.tipo === 'Venda' ? 'Vendido' : loteAntes.status || 'Ativo';
          }

          if (mudou) {
            await API.save('lotes', loteAntes.id, patch);
            await API.reload('lotes');
          }
        }

        ctx.close();
        UI.toast(edit ? 'Manejo atualizado' : 'Manejo registrado', 'ok');
        App.rerender();
      }
    });
  }

  /* ================= Exclusão genérica ================= */

  const TABLE_LABEL = {
    lotes: 'lote', manejos: 'manejo', matrizes: 'matriz', partos: 'parto',
    financeiro: 'lançamento', estoque: 'item de estoque'
  };

  async function confirmDelete(table, id, rotulo) {
    const ok = await UI.confirmDialog(
      'Excluir ' + (rotulo || TABLE_LABEL[table] || 'registro') + '?',
      'Esta ação remove o registro permanentemente. Não é possível desfazer.',
      'Excluir', true
    );
    if (!ok) return;
    try {
      await API.deleteRow(table, id);
      UI.toast('Registro excluído', 'ok');
      App.rerender();
    } catch (err) {
      console.error(err);
      UI.toast('Falha ao excluir: ' + (err.message || 'erro'), 'err');
    }
  }

  return {
    register, get, all: reg, makeChart, destroyCharts, setupChartDefaults,
    kpi, faseBadge, statusLoteBadge, tipoIcone, loteOptions, matrizOptions, semDados,
    openLoteForm, openManejoForm, confirmDelete, sugerirCodigoLote, exportLotes
  };
})();
