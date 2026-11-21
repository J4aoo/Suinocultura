/* ==========================================================================
   views-mgmt.js — Financeiro, Estoque, Relatórios e Ajustes
   ========================================================================== */
(function () {
  'use strict';

  const V = Views;

  /* ================= FINANCEIRO ================= */

  const finFilters = { tipo: '', categoria: '', periodo: '90', busca: '' };

  V.register('financeiro', {
    title: 'Financeiro',
    sub: 'Receitas, despesas e resultado da granja',
    render(el) {
      const todos = (API.state.financeiro || []).slice().sort((a, b) => (UI.toDate(b.data) || 0) - (UI.toDate(a.data) || 0));
      const limite = finFilters.periodo === 'todos' ? null : UI.addDays(new Date(), -parseInt(finFilters.periodo, 10));

      const noPeriodo = todos.filter(f => {
        const d = UI.toDate(f.data);
        return !limite || (d && d >= limite);
      });
      const resumoPeriodo = Analytics.finSummary(noPeriodo);

      const lista = noPeriodo
        .filter(f => finFilters.tipo ? f.tipo === finFilters.tipo : true)
        .filter(f => finFilters.categoria ? f.categoria === finFilters.categoria : true)
        .filter(f => {
          const q = finFilters.busca.toLowerCase();
          if (!q) return true;
          return [f.descricao, f.categoria, f.observacoes].join(' ').toLowerCase().includes(q);
        });

      const serie = Analytics.serieMensal(6);

      // Custos por lote (rateio)
      const porLote = {};
      noPeriodo.forEach(f => {
        if (!f.lote_id) return;
        if (!porLote[f.lote_id]) porLote[f.lote_id] = { receita: 0, despesa: 0 };
        if (f.tipo === 'Receita') porLote[f.lote_id].receita += UI.n0(f.valor);
        else porLote[f.lote_id].despesa += UI.n0(f.valor);
      });

      el.innerHTML =
        '<section class="grid kpis" style="margin-bottom:16px">' +
          V.kpi({ label: 'Receitas', icon: '📈', accent: 'a-green', value: UI.money(resumoPeriodo.receita), foot: 'no período selecionado' }) +
          V.kpi({ label: 'Despesas', icon: '📉', accent: 'a-amber', value: UI.money(resumoPeriodo.despesa), foot: 'no período selecionado' }) +
          V.kpi({ label: 'Saldo', icon: '💰', accent: resumoPeriodo.saldo >= 0 ? 'a-green' : 'a-red',
            value: '<span class="' + (resumoPeriodo.saldo >= 0 ? 'up' : 'down') + '">' + UI.money(resumoPeriodo.saldo) + '</span>',
            foot: resumoPeriodo.count + ' lançamento(s)' }) +
          V.kpi({ label: 'Margem', icon: '🎯', accent: 'a-blue',
            value: resumoPeriodo.receita > 0 ? UI.pct((resumoPeriodo.saldo / resumoPeriodo.receita) * 100) : '—',
            foot: 'saldo sobre receita' }) +
        '</section>' +

        '<section class="grid cols-2-1" style="margin-bottom:16px">' +
          '<div class="card"><div class="card-head"><div><h2>Fluxo mensal</h2><div class="sub">Últimos 6 meses</div></div></div>' +
            '<div class="chart-box"><canvas id="chart-fin-mensal"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><div><h2>Despesas por categoria</h2><div class="sub">No período</div></div></div>' +
            '<div class="chart-box"><canvas id="chart-fin-cat"></canvas></div></div>' +
        '</section>' +

        '<div class="toolbar">' +
          '<label class="search"><span aria-hidden="true">🔍</span><input id="fn-busca" type="search" placeholder="Buscar descrição…" value="' + UI.esc(finFilters.busca) + '"></label>' +
          '<select class="filter" id="fn-periodo" aria-label="Período">' +
            [['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['365', 'Último ano'], ['todos', 'Todo o período']]
              .map(([v, l]) => '<option value="' + v + '"' + (finFilters.periodo === v ? ' selected' : '') + '>' + l + '</option>').join('') +
          '</select>' +
          '<select class="filter" id="fn-tipo" aria-label="Tipo">' +
            '<option value="">Todos</option>' +
            ['Receita', 'Despesa'].map(t => '<option value="' + t + '"' + (finFilters.tipo === t ? ' selected' : '') + '>' + t + '</option>').join('') +
          '</select>' +
          '<div class="grow"></div>' +
          '<button class="btn" id="fn-export">⬇️ CSV</button>' +
          '<button class="btn btn-primary" id="fn-novo">＋ Novo lançamento</button>' +
        '</div>' +

        '<div class="card">' +
          (lista.length
            ? '<div class="table-wrap"><table class="data"><thead><tr>' +
              '<th>Data</th><th>Descrição</th><th>Categoria</th><th>Lote</th>' +
              '<th class="num">Animais</th><th class="num">Valor</th><th></th></tr></thead><tbody>' +
              lista.map(f =>
                '<tr>' +
                '<td class="nowrap small">' + UI.fmtDate(f.data) + '</td>' +
                '<td><strong>' + UI.esc(f.descricao || '—') + '</strong>' +
                  (f.observacoes ? '<div class="small muted">' + UI.esc(f.observacoes) + '</div>' : '') + '</td>' +
                '<td class="small">' + UI.esc(f.categoria || '—') + '</td>' +
                '<td class="small">' + (f.lote_id ? UI.esc(Analytics.loteNome(f.lote_id)) : '—') + '</td>' +
                '<td class="num">' + (f.quantidade ? UI.int(f.quantidade) : '—') + '</td>' +
                '<td class="num" style="color:' + (f.tipo === 'Receita' ? 'var(--green-600)' : 'var(--red-600)') + ';font-weight:700">' +
                  (f.tipo === 'Receita' ? '+' : '−') + ' ' + UI.money(f.valor) + '</td>' +
                '<td><div class="row-actions">' +
                  '<button class="btn btn-sm" data-fn-edit="' + f.id + '">Editar</button>' +
                  '<button class="btn btn-sm btn-danger" data-fn-del="' + f.id + '">✕</button>' +
                '</div></td></tr>').join('') +
              '</tbody></table></div>'
            : UI.emptyState('💰', 'Nenhum lançamento',
                'Registre compras de ração, vendas de animais e demais receitas e despesas para conhecer o resultado real da granja.',
                '<button class="btn btn-primary" data-novo-fn>＋ Novo lançamento</button>')) +
        '</div>' +

        (Object.keys(porLote).length
          ? '<section class="card" style="margin-top:16px"><div class="card-head"><div><h2>Resultado por lote</h2><div class="sub">Receitas e despesas vinculadas a lotes</div></div></div>' +
            '<div class="table-wrap"><table class="data"><thead><tr><th>Lote</th><th class="num">Receita</th><th class="num">Despesa</th><th class="num">Saldo</th></tr></thead><tbody>' +
            Object.keys(porLote).map(id => {
              const r = porLote[id];
              const s = r.receita - r.despesa;
              return '<tr><td><strong>' + UI.esc(Analytics.loteNome(id)) + '</strong></td>' +
                '<td class="num" style="color:var(--green-600)">' + UI.money(r.receita) + '</td>' +
                '<td class="num" style="color:var(--red-600)">' + UI.money(r.despesa) + '</td>' +
                '<td class="num" style="font-weight:700;color:' + (s >= 0 ? 'var(--green-600)' : 'var(--red-600)') + '">' + UI.money(s) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>'
          : '');

      el.querySelector('#fn-busca').addEventListener('input', (e) => { finFilters.busca = e.target.value; App.rerender(); });
      el.querySelector('#fn-periodo').addEventListener('change', (e) => { finFilters.periodo = e.target.value; App.rerender(); });
      el.querySelector('#fn-tipo').addEventListener('change', (e) => { finFilters.tipo = e.target.value; App.rerender(); });
      el.querySelector('#fn-novo').addEventListener('click', () => openFinForm());
      const alt = el.querySelector('[data-novo-fn]');
      if (alt) alt.addEventListener('click', () => openFinForm());
      el.querySelector('#fn-export').addEventListener('click', () => {
        const rows = lista.map(f => ({
          data: UI.dateInput(f.data), tipo: f.tipo, categoria: f.categoria, descricao: f.descricao,
          valor: f.valor, lote: f.lote_id ? Analytics.loteNome(f.lote_id) : '',
          quantidade: f.quantidade || '', peso: f.peso_kg || '', obs: f.observacoes || ''
        }));
        UI.download('financeiro-' + UI.today() + '.csv', UI.toCsv(rows, [
          { key: 'data', label: 'Data' }, { key: 'tipo', label: 'Tipo' }, { key: 'categoria', label: 'Categoria' },
          { key: 'descricao', label: 'Descrição' }, { key: 'valor', label: 'Valor (R$)' }, { key: 'lote', label: 'Lote' },
          { key: 'quantidade', label: 'Animais' }, { key: 'peso', label: 'Peso (kg)' }, { key: 'obs', label: 'Observações' }
        ]));
        UI.toast('CSV financeiro exportado', 'ok');
      });
      el.querySelectorAll('[data-fn-edit]').forEach(b => b.addEventListener('click', () => openFinForm(API.byId('financeiro', b.dataset.fnEdit))));
      el.querySelectorAll('[data-fn-del]').forEach(b => b.addEventListener('click', () => V.confirmDelete('financeiro', b.dataset.fnDel, 'lançamento')));

      V.makeChart('chart-fin-mensal', {
        type: 'line',
        data: {
          labels: serie.labels,
          datasets: [
            { label: 'Receitas', data: serie.receitas, borderColor: '#2ea372', backgroundColor: 'rgba(46,163,114,.14)', fill: true, tension: .35, pointRadius: 3, borderWidth: 2 },
            { label: 'Despesas', data: serie.despesas, borderColor: '#e2a24b', backgroundColor: 'rgba(226,162,75,.12)', fill: true, tension: .35, pointRadius: 3, borderWidth: 2 }
          ]
        },
        options: {
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + (v >= 1000 ? (v / 1000) + 'k' : v) } },
            x: { grid: { display: false } }
          }
        }
      });

      const cats = Object.keys(resumoPeriodo.porCategoria)
        .map(k => ({ k, v: resumoPeriodo.porCategoria[k].despesa }))
        .filter(x => x.v > 0)
        .sort((a, b) => b.v - a.v);

      V.makeChart('chart-fin-cat', {
        type: 'doughnut',
        data: {
          labels: cats.length ? cats.map(c => c.k) : ['Sem despesas'],
          datasets: [{
            data: cats.length ? cats.map(c => c.v) : [1],
            backgroundColor: cats.length
              ? ['#1a6b4a', '#2ea372', '#6fbf9b', '#e2a24b', '#c97a12', '#8a9a93', '#2563eb', '#7c9c8e', '#b6c4bd', '#d7ddd9']
              : ['#eef2f0'],
            borderWidth: 0
          }]
        },
        options: {
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } },
            tooltip: { callbacks: { label: c => c.label + ': ' + UI.money(c.parsed) } }
          }
        }
      });
    }
  });

  function openFinForm(lanc) {
    const edit = !!lanc;
    UI.formModal({
      title: edit ? 'Editar lançamento' : 'Novo lançamento',
      subtitle: 'Receitas e despesas da granja',
      wide: true,
      fields: [
        { name: 'data', label: 'Data', type: 'date', required: true, value: edit ? UI.dateInput(lanc.data) : UI.today() },
        { name: 'tipo', label: 'Tipo', type: 'select', required: true, value: edit ? lanc.tipo : 'Despesa', options: ['Receita', 'Despesa'] },
        { name: 'categoria', label: 'Categoria', type: 'select', required: true, value: edit ? lanc.categoria : 'Compra de ração',
          options: ['Venda de animais', 'Venda de esterco', 'Compra de ração', 'Compra de animais', 'Veterinário/Sanidade', 'Mão de obra', 'Energia/Água', 'Manutenção', 'Instalações/Equipamentos', 'Transporte', 'Outros'] },
        { name: 'valor', label: 'Valor (R$)', type: 'number', required: true, min: 0, value: edit ? lanc.valor : '' },
        { name: 'descricao', label: 'Descrição', type: 'text', value: edit ? lanc.descricao : '', placeholder: 'Ex.: 20 sacos de ração de creche', full: true },
        { name: 'lote_id', label: 'Lote relacionado', type: 'select', value: edit ? lanc.lote_id : '', options: V.loteOptions(false), help: 'Opcional — permite o resultado por lote' },
        { name: 'quantidade', label: 'Quantidade de animais', type: 'number', min: 0, value: edit ? lanc.quantidade : '' },
        { name: 'peso_kg', label: 'Peso total (kg)', type: 'number', min: 0, value: edit ? lanc.peso_kg : '', help: 'Útil em vendas para calcular R$/kg' },
        { name: 'observacoes', label: 'Forma de pagamento / observações', type: 'text', value: edit ? lanc.observacoes : '' }
      ],
      submitLabel: edit ? 'Salvar alterações' : 'Lançar',
      onSubmit: async (data, ctx) => {
        await API.save('financeiro', edit ? lanc.id : null, data);
        ctx.close();
        UI.toast(edit ? 'Lançamento atualizado' : 'Lançamento registrado', 'ok');
        App.rerender();
      }
    });
  }

  /* ================= ESTOQUE ================= */

  const estFilters = { busca: '', categoria: '', alerta: false };

  V.register('estoque', {
    title: 'Estoque',
    sub: 'Ração, medicamentos, vacinas e materiais',
    render(el) {
      const res = Analytics.estoqueResumo();
      const cfg = Settings.read();

      const lista = res.detalhe
        .filter(d => estFilters.categoria ? d.item.categoria === estFilters.categoria : true)
        .filter(d => estFilters.alerta ? (d.baixo || d.statusVal !== 'ok') : true)
        .filter(d => {
          const q = estFilters.busca.toLowerCase();
          if (!q) return true;
          return [d.item.produto, d.item.fornecedor, d.item.categoria].join(' ').toLowerCase().includes(q);
        })
        .sort((a, b) => {
          const pa = (a.baixo ? 0 : 1) + (a.statusVal !== 'ok' ? 0 : 1);
          const pb = (b.baixo ? 0 : 1) + (b.statusVal !== 'ok' ? 0 : 1);
          if (pa !== pb) return pa - pb;
          return String(a.item.produto || '').localeCompare(String(b.item.produto || ''));
        });

      el.innerHTML =
        '<section class="grid kpis" style="margin-bottom:16px">' +
          V.kpi({ label: 'Itens cadastrados', icon: '📦', accent: 'a-green', value: UI.int(res.itens.length), foot: res.itens.length + ' produto(s)' }) +
          V.kpi({ label: 'Valor em estoque', icon: '💰', accent: 'a-blue', value: UI.money(res.valor), foot: 'quantidade × custo unitário' }) +
          V.kpi({ label: 'Abaixo do mínimo', icon: '⚠️', accent: res.baixos ? 'a-amber' : 'a-green', value: UI.int(res.baixos), foot: 'repor com urgência' }) +
          V.kpi({ label: 'Vencendo / vencidos', icon: '⏳', accent: (res.vencidos ? 'a-red' : res.vencendo ? 'a-amber' : 'a-green'),
            value: UI.int(res.vencendo + res.vencidos), foot: 'alerta em ' + cfg.alertaValidade + ' dias' }) +
        '</section>' +

        '<div class="toolbar">' +
          '<label class="search"><span aria-hidden="true">🔍</span><input id="es-busca" type="search" placeholder="Buscar produto, fornecedor…" value="' + UI.esc(estFilters.busca) + '"></label>' +
          '<select class="filter" id="es-cat" aria-label="Categoria">' +
            '<option value="">Todas as categorias</option>' +
            ['Ração', 'Medicamento', 'Vacina', 'Higiene', 'Equipamento', 'Outros']
              .map(c => '<option value="' + c + '"' + (estFilters.categoria === c ? ' selected' : '') + '>' + c + '</option>').join('') +
          '</select>' +
          '<button class="btn' + (estFilters.alerta ? ' btn-amber' : '') + ' btn-sm" id="es-alerta" aria-pressed="' + estFilters.alerta + '">⚠️ Só alertas</button>' +
          '<div class="grow"></div>' +
          '<button class="btn btn-primary" id="es-novo">＋ Novo item</button>' +
        '</div>' +

        '<div class="card">' +
          (lista.length
            ? '<div class="table-wrap"><table class="data"><thead><tr>' +
              '<th>Produto</th><th>Categoria</th><th class="num">Quantidade</th><th>Nível</th>' +
              '<th class="num">Custo un.</th><th class="num">Total</th><th>Validade</th><th>Fornecedor</th><th></th></tr></thead><tbody>' +
              lista.map(d => {
                const pctNivel = d.min > 0 ? Math.min((d.q / (d.min * 2)) * 100, 100) : (d.q > 0 ? 100 : 0);
                const cls = d.q === 0 ? 'danger' : d.baixo ? 'warn' : '';
                const valBadge = d.statusVal === 'vencido' ? UI.badge('vencido', 'red')
                  : d.statusVal === 'vencendo' ? UI.badge('vence em ' + d.diasValidade + 'd', 'amber')
                  : d.item.validade ? '<span class="small muted">' + UI.fmtDate(d.item.validade) + '</span>' : '<span class="small muted">—</span>';
                return '<tr>' +
                  '<td><strong>' + UI.esc(d.item.produto || '—') + '</strong>' +
                    (d.item.observacoes ? '<div class="small muted">' + UI.esc(d.item.observacoes) + '</div>' : '') + '</td>' +
                  '<td>' + UI.badge(d.item.categoria || '—', d.item.categoria === 'Ração' ? 'green' : d.item.categoria === 'Vacina' ? 'blue' : 'gray') + '</td>' +
                  '<td class="num"><strong>' + UI.dec(d.q) + '</strong> <span class="small muted">' + UI.esc(d.item.unidade || 'un') + '</span></td>' +
                  '<td style="min-width:100px"><div class="bar ' + cls + '"><i style="width:' + pctNivel.toFixed(0) + '%"></i></div>' +
                    (d.min > 0 ? '<div class="small muted" style="margin-top:3px">mín. ' + UI.dec(d.min) + '</div>' : '') + '</td>' +
                  '<td class="num">' + (d.cu > 0 ? UI.money(d.cu) : '—') + '</td>' +
                  '<td class="num">' + (d.valorTotal > 0 ? UI.money(d.valorTotal) : '—') + '</td>' +
                  '<td>' + valBadge + '</td>' +
                  '<td class="small">' + UI.esc(d.item.fornecedor || '—') + '</td>' +
                  '<td><div class="row-actions">' +
                    '<button class="btn btn-sm btn-icon" data-es-add="' + d.item.id + '" title="Entrada de estoque" aria-label="Entrada de estoque">＋</button>' +
                    '<button class="btn btn-sm btn-icon" data-es-edit="' + d.item.id + '" title="Editar" aria-label="Editar">✎</button>' +
                    '<button class="btn btn-sm btn-icon btn-danger" data-es-del="' + d.item.id + '" title="Excluir" aria-label="Excluir">✕</button>' +
                  '</div></td></tr>';
              }).join('') +
              '</tbody></table></div>'
            : UI.emptyState('📦', 'Nenhum item no estoque',
                'Cadastre ração, vacinas, medicamentos e materiais para controlar consumo, custos e validade.',
                '<button class="btn btn-primary" data-novo-es>＋ Cadastrar item</button>')) +
        '</div>';

      el.querySelector('#es-busca').addEventListener('input', (e) => { estFilters.busca = e.target.value; App.rerender(); });
      el.querySelector('#es-cat').addEventListener('change', (e) => { estFilters.categoria = e.target.value; App.rerender(); });
      el.querySelector('#es-alerta').addEventListener('click', () => { estFilters.alerta = !estFilters.alerta; App.rerender(); });
      el.querySelector('#es-novo').addEventListener('click', () => openEstoqueForm());
      const alt = el.querySelector('[data-novo-es]');
      if (alt) alt.addEventListener('click', () => openEstoqueForm());
      el.querySelectorAll('[data-es-edit]').forEach(b => b.addEventListener('click', () => openEstoqueForm(API.byId('estoque', b.dataset.esEdit))));
      el.querySelectorAll('[data-es-del]').forEach(b => b.addEventListener('click', () => V.confirmDelete('estoque', b.dataset.esDel, 'item de estoque')));
      el.querySelectorAll('[data-es-add]').forEach(b => b.addEventListener('click', () => openMovEstoque(API.byId('estoque', b.dataset.esAdd))));
    }
  });

  function openEstoqueForm(item) {
    const edit = !!item;
    UI.formModal({
      title: edit ? 'Editar item' : 'Novo item de estoque',
      subtitle: 'Controle de insumos',
      wide: true,
      fields: [
        { name: 'produto', label: 'Produto', type: 'text', required: true, value: edit ? item.produto : '', placeholder: 'Ração de creche 1', full: true },
        { name: 'categoria', label: 'Categoria', type: 'select', required: true, value: edit ? item.categoria : 'Ração', options: ['Ração', 'Medicamento', 'Vacina', 'Higiene', 'Equipamento', 'Outros'] },
        { name: 'unidade', label: 'Unidade', type: 'select', value: edit ? (item.unidade || 'kg') : 'kg', options: ['kg', 'saco', 'L', 'un', 'dose', 'frasco'] },
        { name: 'quantidade', label: 'Quantidade atual', type: 'number', required: true, min: 0, value: edit ? item.quantidade : 0 },
        { name: 'estoque_minimo', label: 'Estoque mínimo (alerta)', type: 'number', min: 0, value: edit ? item.estoque_minimo : '' },
        { name: 'custo_unitario', label: 'Custo unitário (R$)', type: 'number', min: 0, value: edit ? item.custo_unitario : '' },
        { name: 'validade', label: 'Validade', type: 'date', value: edit ? UI.dateInput(item.validade) : '' },
        { name: 'fornecedor', label: 'Fornecedor', type: 'text', value: edit ? item.fornecedor : '' },
        { name: 'observacoes', label: 'Observações', type: 'textarea', full: true, value: edit ? item.observacoes : '' }
      ],
      submitLabel: edit ? 'Salvar alterações' : 'Cadastrar item',
      onSubmit: async (data, ctx) => {
        await API.save('estoque', edit ? item.id : null, data);
        ctx.close();
        UI.toast(edit ? 'Item atualizado' : 'Item cadastrado', 'ok');
        App.rerender();
      }
    });
  }

  function openMovEstoque(item) {
    if (!item) return;
    UI.formModal({
      title: 'Movimentar estoque',
      subtitle: item.produto + ' — atual: ' + UI.dec(item.quantidade) + ' ' + (item.unidade || 'un'),
      fields: [
        { name: 'operacao', label: 'Operação', type: 'select', required: true, value: 'entrada', options: [{ value: 'entrada', label: 'Entrada (compra/recebimento)' }, { value: 'saida', label: 'Saída (consumo)' }] },
        { name: 'quantidade', label: 'Quantidade', type: 'number', required: true, min: 0, value: '' },
        { name: 'custo_unitario', label: 'Atualizar custo unitário (R$)', type: 'number', min: 0, value: item.custo_unitario || '', help: 'Opcional — usado em entradas' },
        { name: 'registrar_despesa', label: 'Registrar a entrada como despesa no financeiro', type: 'checkbox', value: true, full: true }
      ],
      submitLabel: 'Confirmar',
      onSubmit: async (data, ctx) => {
        const q = UI.n0(data.quantidade);
        if (q <= 0) { UI.toast('Informe uma quantidade maior que zero', 'err'); return; }

        const atual = UI.n0(item.quantidade);
        const novo = data.operacao === 'entrada' ? atual + q : Math.max(atual - q, 0);
        const patch = { quantidade: novo };
        const cu = UI.n0(data.custo_unitario);
        if (cu > 0) patch.custo_unitario = cu;

        await API.save('estoque', item.id, patch);

        if (data.operacao === 'entrada' && data.registrar_despesa) {
          const valor = q * (cu > 0 ? cu : UI.n0(item.custo_unitario));
          if (valor > 0) {
            await API.save('financeiro', null, {
              data: UI.today(),
              tipo: 'Despesa',
              categoria: item.categoria === 'Ração' ? 'Compra de ração' : (item.categoria === 'Vacina' || item.categoria === 'Medicamento') ? 'Veterinário/Sanidade' : 'Outros',
              descricao: 'Entrada de estoque: ' + item.produto + ' (' + UI.dec(q) + ' ' + (item.unidade || 'un') + ')',
              valor: valor
            });
            await API.reload('financeiro');
          }
        }

        ctx.close();
        UI.toast('Estoque atualizado', 'ok');
        App.rerender();
      }
    });
  }

  /* ================= RELATÓRIOS ================= */

  V.register('relatorios', {
    title: 'Relatórios',
    sub: 'Indicadores consolidados e exportação',
    render(el) {
      const t = Analytics.totais();
      const repro = Analytics.repro();
      const est = Analytics.estoqueResumo();
      const fin12 = Analytics.finPeriodo(365);
      const fase = Analytics.porFase();
      const serie = Analytics.serieMensal(12);
      const cfg = Settings.read();

      const ativos = Analytics.lotesAtivos();
      const gpdMedio = (() => {
        const vals = ativos.map(l => Analytics.loteMetrics(l).gpd).filter(v => isFinite(v) && v > 0);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
      })();
      const caMedio = (() => {
        const vals = ativos.map(l => Analytics.loteMetrics(l).ca).filter(v => isFinite(v) && v > 0);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
      })();

      el.innerHTML =
        '<div class="toolbar no-print">' +
          '<div class="strong">Resumo do plantel</div>' +
          '<div class="grow"></div>' +
          '<button class="btn" id="rp-print">🖨️ Imprimir / PDF</button>' +
          '<button class="btn btn-primary" id="rp-csv">⬇️ Exportar indicadores</button>' +
        '</div>' +

        '<section class="grid cols-2" style="margin-bottom:16px">' +
          '<div class="card"><div class="card-head"><div><h2>Desempenho do plantel</h2><div class="sub">Médias dos lotes ativos</div></div></div>' +
            '<div class="card-pad"><table class="data"><tbody>' +
              row('Animais alojados', UI.int(t.animais) + ' cabeças') +
              row('Lotes ativos', UI.int(t.lotesAtivos)) +
              row('Peso vivo total', t.pesoVivo > 0 ? UI.int(t.pesoVivo) + ' kg (' + UI.dec(t.pesoVivo / 1000, 1) + ' t)' : '—') +
              row('Ganho médio diário', isFinite(gpdMedio) ? UI.dec(gpdMedio * 1000) + ' g/dia' : '—') +
              row('Conversão alimentar média', isFinite(caMedio) ? UI.dec(caMedio, 2) : '—', isFinite(caMedio) && caMedio <= cfg.metaCA ? 'ok' : 'warn') +
              row('Mortalidade acumulada', isFinite(t.mortalidade) ? UI.pct(t.mortalidade) : '—', isFinite(t.mortalidade) && t.mortalidade <= cfg.limiteMortalidade ? 'ok' : 'warn') +
              row('Custo acumulado dos lotes', UI.money(t.custo)) +
            '</tbody></table></div></div>' +

          '<div class="card"><div class="card-head"><div><h2>Reprodução</h2><div class="sub">Últimos partos registrados</div></div></div>' +
            '<div class="card-pad"><table class="data"><tbody>' +
              row('Matrizes ativas', UI.int(repro.ativas)) +
              row('Partos registrados', UI.int(repro.totPartos)) +
              row('Leitões nascidos por parto', isFinite(repro.mediaNascidos) ? UI.dec(repro.mediaNascidos, 1) : '—') +
              row('Nascidos vivos por parto', isFinite(repro.mediaVivos) ? UI.dec(repro.mediaVivos, 1) : '—') +
              row('Desmamados por parto', isFinite(repro.mediaDesmamados) ? UI.dec(repro.mediaDesmamados, 1) : '—') +
              row('Taxa de desmame', isFinite(repro.taxaDesmame) ? UI.pct(repro.taxaDesmame) : '—') +
              row('Desmamados/matriz/ano', isFinite(repro.desmamadosPorMatrizAno) ? UI.dec(repro.desmamadosPorMatrizAno, 1) : '—') +
            '</tbody></table></div></div>' +
        '</section>' +

        '<section class="grid cols-2" style="margin-bottom:16px">' +
          '<div class="card"><div class="card-head"><div><h2>Animais por fase</h2><div class="sub">Distribuição atual do plantel</div></div></div>' +
            '<div class="chart-box"><canvas id="chart-rp-fase"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><div><h2>Resultado mensal</h2><div class="sub">Últimos 12 meses</div></div></div>' +
            '<div class="chart-box"><canvas id="chart-rp-mensal"></canvas></div></div>' +
        '</section>' +

        '<section class="card" style="margin-bottom:16px"><div class="card-head"><div><h2>Resultado financeiro (12 meses)</h2></div></div>' +
          '<div class="card-pad"><div class="grid cols-3">' +
            '<div class="metric"><div class="l">Receitas</div><div class="v" style="color:var(--green-600)">' + UI.money(fin12.receita) + '</div></div>' +
            '<div class="metric"><div class="l">Despesas</div><div class="v" style="color:var(--red-600)">' + UI.money(fin12.despesa) + '</div></div>' +
            '<div class="metric"><div class="l">Resultado</div><div class="v" style="color:' + (fin12.saldo >= 0 ? 'var(--green-600)' : 'var(--red-600)') + '">' + UI.money(fin12.saldo) + '</div></div>' +
          '</div>' +
          (t.animais > 0 ? '<p class="small muted" style="margin:12px 0 0">Custo médio estimado por animal alojado: <strong>' +
            UI.money((fin12.despesa + t.custo) / t.animais) + '</strong> (despesas do ano + custo acumulado dos lotes ÷ animais atuais).</p>' : '') +
          '</div></section>' +

        '<section class="card"><div class="card-head"><div><h2>Estoque consolidado</h2><div class="sub">' + est.itens.length + ' itens · ' + UI.money(est.valor) + '</div></div></div>' +
          (est.detalhe.length
            ? '<div class="table-wrap"><table class="data"><thead><tr><th>Produto</th><th>Categoria</th><th class="num">Qtd</th><th class="num">Valor</th><th>Situação</th></tr></thead><tbody>' +
              est.detalhe.map(d =>
                '<tr><td><strong>' + UI.esc(d.item.produto) + '</strong></td><td class="small">' + UI.esc(d.item.categoria || '—') + '</td>' +
                '<td class="num">' + UI.dec(d.q) + ' ' + UI.esc(d.item.unidade || '') + '</td>' +
                '<td class="num">' + UI.money(d.valorTotal) + '</td>' +
                '<td>' + (d.statusVal === 'vencido' ? UI.badge('vencido', 'red') :
                  d.baixo ? UI.badge('repor', 'amber') :
                  d.statusVal === 'vencendo' ? UI.badge('vence em ' + d.diasValidade + 'd', 'amber') : UI.badge('ok', 'green')) + '</td></tr>').join('') +
              '</tbody></table></div>'
            : V.semDados('Sem itens de estoque', 'Cadastre insumos na aba Estoque para ver o consolidado.')) +
        '</section>';

      V.makeChart('chart-rp-fase', {
        type: 'bar',
        data: {
          labels: Object.keys(fase),
          datasets: [{ label: 'Animais', data: Object.values(fase), backgroundColor: ['#c97a12', '#2563eb', '#2ea372', '#1a6b4a', '#6fbf9b'], borderRadius: 6, maxBarThickness: 46 }]
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, grid: { color: '#f0f4f2' } }, y: { grid: { display: false } } }
        }
      });

      V.makeChart('chart-rp-mensal', {
        type: 'bar',
        data: {
          labels: serie.labels,
          datasets: [
            { label: 'Receitas', data: serie.receitas, backgroundColor: '#2ea372', borderRadius: 5, maxBarThickness: 16 },
            { label: 'Despesas', data: serie.despesas, backgroundColor: '#e2a24b', borderRadius: 5, maxBarThickness: 16 }
          ]
        },
        options: {
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + (Math.abs(v) >= 1000 ? (v / 1000) + 'k' : v) }, grid: { color: '#f0f4f2' } },
            x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, font: { size: 10 } } }
          },
          plugins: { legend: { position: 'bottom' } }
        }
      });

      const btnPrint = el.querySelector('#rp-print');
      // No app Android não existe impressão pelo WebView: use "Exportar CSV".
      if (UI.appNativo()) btnPrint.hidden = true;
      else btnPrint.addEventListener('click', () => window.print());
      el.querySelector('#rp-csv').addEventListener('click', () => {
        const rows = [
          { ind: 'Animais alojados', val: t.animais },
          { ind: 'Lotes ativos', val: t.lotesAtivos },
          { ind: 'Peso vivo total (kg)', val: t.pesoVivo.toFixed(1) },
          { ind: 'GPD medio (g/dia)', val: isFinite(gpdMedio) ? (gpdMedio * 1000).toFixed(0) : '' },
          { ind: 'Conversao alimentar media', val: isFinite(caMedio) ? caMedio.toFixed(2) : '' },
          { ind: 'Mortalidade acumulada (%)', val: isFinite(t.mortalidade) ? t.mortalidade.toFixed(1) : '' },
          { ind: 'Custo acumulado lotes (R$)', val: t.custo.toFixed(2) },
          { ind: 'Matrizes ativas', val: repro.ativas },
          { ind: 'Partos registrados', val: repro.totPartos },
          { ind: 'Nascidos vivos/parto', val: isFinite(repro.mediaVivos) ? repro.mediaVivos.toFixed(1) : '' },
          { ind: 'Desmamados/parto', val: isFinite(repro.mediaDesmamados) ? repro.mediaDesmamados.toFixed(1) : '' },
          { ind: 'Taxa de desmame (%)', val: isFinite(repro.taxaDesmame) ? repro.taxaDesmame.toFixed(1) : '' },
          { ind: 'Receitas 12m (R$)', val: fin12.receita.toFixed(2) },
          { ind: 'Despesas 12m (R$)', val: fin12.despesa.toFixed(2) },
          { ind: 'Resultado 12m (R$)', val: fin12.saldo.toFixed(2) },
          { ind: 'Valor em estoque (R$)', val: est.valor.toFixed(2) }
        ];
        UI.download('indicadores-' + UI.today() + '.csv', UI.toCsv(rows, [
          { key: 'ind', label: 'Indicador' }, { key: 'val', label: 'Valor' }
        ]));
        UI.toast('Indicadores exportados', 'ok');
      });
    }
  });

  function row(label, value, flag) {
    const badge = flag === 'ok' ? ' ' + UI.badge('ok', 'green') : flag === 'warn' ? ' ' + UI.badge('atenção', 'amber') : '';
    return '<tr><td class="muted">' + UI.esc(label) + '</td><td class="num strong">' + value + badge + '</td></tr>';
  }

  /* ================= AJUSTES ================= */

  V.register('ajustes', {
    title: 'Ajustes',
    sub: 'Configurações da granja e gerenciamento de dados',
    render(el) {
      const cfg = Settings.read();
      const counts = {
        lotes: (API.state.lotes || []).length,
        manejos: (API.state.manejos || []).length,
        matrizes: (API.state.matrizes || []).length,
        partos: (API.state.partos || []).length,
        financeiro: (API.state.financeiro || []).length,
        estoque: (API.state.estoque || []).length
      };

      el.innerHTML =
        '<section class="grid cols-2" style="margin-bottom:16px">' +
          '<div class="card"><div class="card-head"><div><h2>Dados da granja</h2><div class="sub">Aparece no topo do aplicativo</div></div></div>' +
            '<div class="card-pad"><form id="cfg-form" class="form-grid">' +
              '<div class="field full"><label for="cfg-nome">Nome da granja</label>' +
                '<input id="cfg-nome" type="text" value="' + UI.esc(cfg.nomeGranja) + '" maxlength="40"></div>' +
              '<div class="field"><label for="cfg-ca">Meta de conversão alimentar</label>' +
                '<input id="cfg-ca" type="number" step="0.05" min="1" value="' + cfg.metaCA + '"><span class="help">Referência típica: 2,5 a 3,2</span></div>' +
              '<div class="field"><label for="cfg-mort">Limite de mortalidade (%)</label>' +
                '<input id="cfg-mort" type="number" step="0.5" min="0" max="100" value="' + cfg.limiteMortalidade + '"><span class="help">Acima disso, gera alerta</span></div>' +
              '<div class="field"><label for="cfg-dias">Dias sem manejo para alertar</label>' +
                '<input id="cfg-dias" type="number" step="1" min="1" value="' + cfg.diasSemManejo + '"></div>' +
              '<div class="field"><label for="cfg-val">Alerta de validade (dias)</label>' +
                '<input id="cfg-val" type="number" step="1" min="1" value="' + cfg.alertaValidade + '"></div>' +
              '<div class="field full"><button class="btn btn-primary" type="submit">Salvar ajustes</button></div>' +
            '</form></div></div>' +

          '<div class="card"><div class="card-head"><div><h2>Registros</h2><div class="sub">Volume de dados armazenados</div></div></div>' +
            '<div class="card-pad"><table class="data"><tbody>' +
              row('Lotes', UI.int(counts.lotes)) +
              row('Manejos', UI.int(counts.manejos)) +
              row('Matrizes', UI.int(counts.matrizes)) +
              row('Partos', UI.int(counts.partos)) +
              row('Lançamentos financeiros', UI.int(counts.financeiro)) +
              row('Itens de estoque', UI.int(counts.estoque)) +
            '</tbody></table>' +
            '<div class="hr"></div>' +
            '<p class="small muted" style="margin:0 0 12px">Faça um backup completo antes de qualquer alteração importante. O arquivo JSON pode ser reimportado neste mesmo aplicativo.</p>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
              '<button class="btn" id="cfg-export">⬇️ Exportar backup (JSON)</button>' +
              '<button class="btn" id="cfg-import">⬆️ Importar backup</button>' +
            '</div>' +
            '<input type="file" id="cfg-file" accept="application/json,.json" hidden>' +
            '</div></div>' +
        '</section>' +

        '<section class="card"><div class="card-head"><div><h2>Sobre o aplicativo</h2><div class="sub">Como os dados funcionam</div></div></div>' +
          '<div class="card-pad">' +
            '<p style="margin:0 0 10px;font-size:13.5px;color:var(--ink-700)">Todos os dados (lotes, manejos, matrizes, partos, financeiro e estoque) ficam salvos <strong>neste aparelho</strong>' + (API.armazenamento === 'SQLite' ? ', num banco de dados SQLite dentro do app. ' : ', neste navegador. ') + '' +
            'Eles não passam para outro celular e somem se o app for desinstalado ou os dados forem apagados. <strong>Exporte o backup toda semana</strong> (envie para o WhatsApp, Drive ou e-mail) e guarde o arquivo.</p>' +
            '<p class="small muted" style="margin:0">Indicadores calculados: ganho médio diário (GPD), conversão alimentar, mortalidade, custo por cabeça, leitões por parto, taxa de desmame e saldo financeiro.</p>' +
          '</div></section>';

      el.querySelector('#cfg-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const next = Settings.write({
          nomeGranja: el.querySelector('#cfg-nome').value.trim() || 'Minha Granja',
          metaCA: UI.n0(el.querySelector('#cfg-ca').value) || 2.8,
          limiteMortalidade: UI.n0(el.querySelector('#cfg-mort').value),
          diasSemManejo: Math.max(UI.n0(el.querySelector('#cfg-dias').value), 1),
          alertaValidade: Math.max(UI.n0(el.querySelector('#cfg-val').value), 1)
        });
        App.applySettings(next);
        UI.toast('Ajustes salvos', 'ok');
        App.rerender();
      });

      el.querySelector('#cfg-export').addEventListener('click', () => {
        const backup = {
          app: 'granja-suina',
          versao: 1,
          exportado_em: new Date().toISOString(),
          ajustes: Settings.read(),
          dados: {
            lotes: API.state.lotes || [],
            manejos: API.state.manejos || [],
            matrizes: API.state.matrizes || [],
            partos: API.state.partos || [],
            financeiro: API.state.financeiro || [],
            estoque: API.state.estoque || []
          }
        };
        UI.download('backup-granja-' + UI.today() + '.json', JSON.stringify(backup, null, 2), 'application/json');
        UI.toast('Backup exportado', 'ok');
      });

      el.querySelector('#cfg-import').addEventListener('click', () => el.querySelector('#cfg-file').click());
      el.querySelector('#cfg-file').addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          let parsed;
          try { parsed = JSON.parse(reader.result); } catch (_) { UI.toast('Arquivo JSON inválido', 'err'); return; }
          const dados = parsed && parsed.dados;
          if (!dados || typeof dados !== 'object') { UI.toast('Backup sem a seção "dados"', 'err'); return; }

          const total = Object.keys(dados).reduce((s, k) => s + (Array.isArray(dados[k]) ? dados[k].length : 0), 0);
          const ok = await UI.confirmDialog(
            'Importar backup?',
            'Serão adicionados ' + total + ' registro(s) às tabelas atuais. Registros existentes não são apagados.',
            'Importar', false
          );
          if (!ok) return;

          let inseridos = 0, falhas = 0;
          for (const table of ['lotes', 'manejos', 'matrizes', 'partos', 'financeiro', 'estoque']) {
            const rows = Array.isArray(dados[table]) ? dados[table] : [];
            for (const r of rows) {
              const payload = Object.assign({}, r);
              delete payload.id;
              delete payload.created_at;
              delete payload.updated_at;
              delete payload.gs_project_id;
              delete payload.gs_table_name;
              delete payload.deleted;
              try { await API.create(table, payload); inseridos++; } catch (err) { falhas++; console.warn('[import]', table, err); }
            }
          }
          await API.loadAll();
          if (parsed.ajustes && typeof parsed.ajustes === 'object') {
            App.applySettings(Settings.write(parsed.ajustes));
          }
          UI.toast('Importados ' + inseridos + ' registro(s)' + (falhas ? ' · ' + falhas + ' falha(s)' : ''), falhas ? 'err' : 'ok');
          App.rerender();
        };
        reader.readAsText(file);
        e.target.value = '';
      });
    }
  });
})();
