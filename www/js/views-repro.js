/* ==========================================================================
   views-repro.js — Matrizes e Partos
   ========================================================================== */
(function () {
  'use strict';

  const V = Views;

  /* ================= MATRIZES ================= */

  const mzFilters = { busca: '', fase: '', status: 'Ativa' };

  V.register('matrizes', {
    title: 'Matrizes',
    sub: 'Plantel reprodutivo e ciclo reprodutivo',
    render(el) {
      const cfg = Settings.read();
      const ativas = Analytics.matrizesAtivas();
      const repro = Analytics.repro();
      const previstos = Analytics.partosPrevistos(15);

      const lista = (API.state.matrizes || [])
        .filter(m => mzFilters.status === 'todos' ? true : (m.status || 'Ativa') === mzFilters.status)
        .filter(m => mzFilters.fase ? m.fase === mzFilters.fase : true)
        .filter(m => {
          const q = mzFilters.busca.toLowerCase();
          if (!q) return true;
          return [m.brinco, m.nome, m.raca, m.observacoes].join(' ').toLowerCase().includes(q);
        })
        .sort((a, b) => String(a.brinco || '').localeCompare(String(b.brinco || '')));

      el.innerHTML =
        '<section class="grid kpis" style="margin-bottom:16px">' +
          V.kpi({ label: 'Matrizes ativas', icon: '🐷', accent: 'a-green', value: UI.int(repro.ativas), foot: repro.porFase.Lactante + ' em lactação' }) +
          V.kpi({ label: 'Gestantes', icon: '🤰', accent: 'a-blue', value: UI.int(repro.porFase.Gestante + repro.porFase.Coberta), foot: 'cobertas + gestantes' }) +
          V.kpi({ label: 'Leitões/parto (média)', icon: '🍼', accent: 'a-amber', value: isFinite(repro.mediaVivos) ? UI.dec(repro.mediaVivos, 1) : '—', foot: 'nascidos vivos' }) +
          V.kpi({ label: 'Desmamados/matriz/ano', icon: '📈', accent: 'a-green', value: isFinite(repro.desmamadosPorMatrizAno) ? UI.dec(repro.desmamadosPorMatrizAno, 1) : '—', foot: 'produtividade do plantel' }) +
        '</section>' +

        (previstos.length
          ? '<div class="card" style="margin-bottom:16px"><div class="card-head"><div><h2>Próximos partos</h2><div class="sub">Acompanhamento dos próximos 15 dias</div></div></div>' +
            '<div class="table-wrap"><table class="data"><thead><tr><th>Matriz</th><th>Previsão</th><th class="num">Faltam</th><th></th></tr></thead><tbody>' +
            previstos.map(x =>
              '<tr><td><strong>' + UI.esc(x.matriz.brinco || '—') + '</strong> <span class="muted small">' + UI.esc(x.matriz.nome || '') + '</span></td>' +
              '<td class="nowrap">' + UI.fmtDate(x.matriz.data_parto_previsto) + '</td>' +
              '<td class="num">' + (x.dias < 0 ? UI.badge(Math.abs(x.dias) + 'd atraso', 'red') : UI.badge(x.dias + ' dia(s)', x.dias <= 7 ? 'amber' : 'gray')) + '</td>' +
              '<td><div class="row-actions"><button class="btn btn-sm btn-primary" data-parto-de="' + x.matriz.id + '">Registrar parto</button></div></td></tr>').join('') +
            '</tbody></table></div></div>'
          : '') +

        '<div class="toolbar">' +
          '<label class="search"><span aria-hidden="true">🔍</span><input id="mz-busca" type="search" placeholder="Buscar brinco, nome, linhagem…" value="' + UI.esc(mzFilters.busca) + '"></label>' +
          '<select class="filter" id="mz-fase" aria-label="Filtrar por fase">' +
            '<option value="">Todas as fases</option>' +
            ['Vazia', 'Coberta', 'Gestante', 'Lactante', 'Descarte'].map(f => '<option value="' + f + '"' + (mzFilters.fase === f ? ' selected' : '') + '>' + f + '</option>').join('') +
          '</select>' +
          '<select class="filter" id="mz-status" aria-label="Filtrar por situação">' +
            ['Ativa', 'Descartada', 'todos'].map(s => '<option value="' + s + '"' + (mzFilters.status === s ? ' selected' : '') + '>' + (s === 'todos' ? 'Todas' : s) + '</option>').join('') +
          '</select>' +
          '<div class="grow"></div>' +
          '<button class="btn btn-primary" id="mz-novo">＋ Nova matriz</button>' +
        '</div>' +

        '<div class="card">' +
          (lista.length
            ? '<div class="table-wrap"><table class="data"><thead><tr>' +
              '<th>Brinco</th><th>Linhagem</th><th>Fase</th><th class="num">Partos</th>' +
              '<th>Último parto</th><th>Próximo parto</th><th class="num">Leitões</th><th></th></tr></thead><tbody>' +
              lista.map(m => {
                const dias = m.data_parto_previsto ? UI.daysBetween(new Date(), m.data_parto_previsto) : NaN;
                const alerta = isFinite(dias) && dias <= 7;
                return '<tr>' +
                  '<td><strong>' + UI.esc(m.brinco || '—') + '</strong>' + (m.nome ? '<div class="small muted">' + UI.esc(m.nome) + '</div>' : '') + '</td>' +
                  '<td class="small">' + UI.esc(m.raca || '—') + '</td>' +
                  '<td>' + UI.badge(m.fase || '—', m.fase === 'Lactante' ? 'amber' : m.fase === 'Gestante' ? 'green' : m.fase === 'Vazia' ? 'gray' : 'blue') + '</td>' +
                  '<td class="num">' + UI.int(m.ordem_parto) + '</td>' +
                  '<td class="nowrap small">' + UI.fmtDate(m.ultimo_parto) + '</td>' +
                  '<td class="nowrap small">' + (m.data_parto_previsto
                    ? (alerta ? '<strong style="color:var(--amber-600)">' + UI.fmtDate(m.data_parto_previsto) + '</strong>' : UI.fmtDate(m.data_parto_previsto))
                    : '—') + '</td>' +
                  '<td class="num">' + (m.leitoes_nascidos ? UI.int(m.leitoes_nascidos) : '—') + '</td>' +
                  '<td><div class="row-actions">' +
                    '<button class="btn btn-sm" data-parto-de="' + m.id + '">Parto</button>' +
                    '<button class="btn btn-sm" data-mz-edit="' + m.id + '">Editar</button>' +
                    '<button class="btn btn-sm btn-danger" data-mz-del="' + m.id + '">✕</button>' +
                  '</div></td></tr>';
              }).join('') +
              '</tbody></table></div>'
            : UI.emptyState('🐷', 'Nenhuma matriz cadastrada',
                'Cadastre as fêmeas reprodutoras para controlar coberturas, partos e desmames.',
                '<button class="btn btn-primary" data-nova-mz>＋ Cadastrar matriz</button>')) +
        '</div>';

      el.querySelector('#mz-busca').addEventListener('input', (e) => { mzFilters.busca = e.target.value; App.rerender(); });
      el.querySelector('#mz-fase').addEventListener('change', (e) => { mzFilters.fase = e.target.value; App.rerender(); });
      el.querySelector('#mz-status').addEventListener('change', (e) => { mzFilters.status = e.target.value; App.rerender(); });
      el.querySelector('#mz-novo').addEventListener('click', () => openMatrizForm());
      const alt = el.querySelector('[data-nova-mz]');
      if (alt) alt.addEventListener('click', () => openMatrizForm());
      el.querySelectorAll('[data-mz-edit]').forEach(b => b.addEventListener('click', () => openMatrizForm(API.byId('matrizes', b.dataset.mzEdit))));
      el.querySelectorAll('[data-mz-del]').forEach(b => b.addEventListener('click', () => V.confirmDelete('matrizes', b.dataset.mzDel, 'matriz')));
      el.querySelectorAll('[data-parto-de]').forEach(b => b.addEventListener('click', () => Stats.openPartoForm(null, b.dataset.partoDe)));
      void cfg;
    }
  });

  function sugerirBrinco() {
    const nums = (API.state.matrizes || [])
      .map(m => parseInt(String(m.brinco || '').replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    return String((nums.length ? Math.max.apply(null, nums) : 0) + 1).padStart(3, '0');
  }

  function openMatrizForm(matriz) {
    const edit = !!matriz;
    const gestacaoDias = 115;

    UI.formModal({
      title: edit ? 'Editar matriz' : 'Nova matriz',
      subtitle: edit ? 'Brinco ' + (matriz.brinco || '') : 'Cadastro de fêmea reprodutora',
      wide: true,
      fields: [
        { name: 'brinco', label: 'Brinco', type: 'text', required: true, value: edit ? matriz.brinco : sugerirBrinco(), placeholder: '001' },
        { name: 'nome', label: 'Nome / apelido', type: 'text', value: edit ? matriz.nome : '' },
        { name: 'raca', label: 'Linhagem / raça', type: 'text', value: edit ? matriz.raca : '', placeholder: 'Landrace × Large White' },
        { name: 'ordem_parto', label: 'Ordem de parto', type: 'number', min: 0, value: edit ? matriz.ordem_parto : 0 },
        { name: 'fase', label: 'Fase reprodutiva', type: 'select', required: true, value: edit ? matriz.fase : 'Vazia', options: ['Vazia', 'Coberta', 'Gestante', 'Lactante', 'Descarte'] },
        { name: 'data_cobertura', label: 'Data da última cobertura', type: 'date', value: edit ? UI.dateInput(matriz.data_cobertura) : '', help: 'A previsão de parto usa 115 dias' },
        { name: 'data_parto_previsto', label: 'Data prevista do parto', type: 'date', value: edit ? UI.dateInput(matriz.data_parto_previsto) : '', help: 'Deixe vazio para calcular da cobertura' },
        { name: 'ultimo_parto', label: 'Data do último parto', type: 'date', value: edit ? UI.dateInput(matriz.ultimo_parto) : '' },
        { name: 'leitoes_nascidos', label: 'Leitões nascidos (último parto)', type: 'number', min: 0, value: edit ? matriz.leitoes_nascidos : '' },
        { name: 'leitoes_desmamados', label: 'Desmamados (último ciclo)', type: 'number', min: 0, value: edit ? matriz.leitoes_desmamados : '' },
        { name: 'status', label: 'Situação', type: 'select', value: edit ? (matriz.status || 'Ativa') : 'Ativa', options: ['Ativa', 'Descartada'] },
        { name: 'observacoes', label: 'Observações', type: 'textarea', full: true, value: edit ? matriz.observacoes : '' }
      ],
      submitLabel: edit ? 'Salvar alterações' : 'Cadastrar matriz',
      onSubmit: async (data, ctx) => {
        // Calcula a previsão de parto a partir da cobertura, se não informada
        if (!data.data_parto_previsto && data.data_cobertura) {
          const prev = UI.addDays(data.data_cobertura, gestacaoDias);
          if (prev) data.data_parto_previsto = UI.dateInput(prev);
        }
        await API.save('matrizes', edit ? matriz.id : null, data);
        ctx.close();
        UI.toast(edit ? 'Matriz atualizada' : 'Matriz cadastrada', 'ok');
        App.rerender();
      }
    });
  }

  /* ================= PARTOS ================= */

  const ptFilters = { busca: '', ano: '' };

  V.register('partos', {
    title: 'Partos',
    sub: 'Histórico de partos, nascidos e desmames',
    render(el) {
      const repro = Analytics.repro();
      const todos = (API.state.partos || []).slice().sort((a, b) => (UI.toDate(b.data) || 0) - (UI.toDate(a.data) || 0));

      const anos = Array.from(new Set(todos.map(p => {
        const d = UI.toDate(p.data);
        return d ? String(d.getFullYear()) : null;
      }).filter(Boolean))).sort().reverse();

      const lista = todos
        .filter(p => ptFilters.ano ? String((UI.toDate(p.data) || {}).getFullYear ? UI.toDate(p.data).getFullYear() : '') === ptFilters.ano : true)
        .filter(p => {
          const q = ptFilters.busca.toLowerCase();
          if (!q) return true;
          return [p.matriz_brinco, p.lote_codigo, p.observacoes].join(' ').toLowerCase().includes(q);
        });

      el.innerHTML =
        '<section class="grid kpis" style="margin-bottom:16px">' +
          V.kpi({ label: 'Partos registrados', icon: '🍼', accent: 'a-green', value: UI.int(repro.totPartos), foot: 'histórico completo' }) +
          V.kpi({ label: 'Nascidos vivos (média)', icon: '🐖', accent: 'a-blue', value: isFinite(repro.mediaVivos) ? UI.dec(repro.mediaVivos, 1) : '—', foot: 'por parto' }) +
          V.kpi({ label: 'Desmamados (média)', icon: '📊', accent: 'a-amber', value: isFinite(repro.mediaDesmamados) ? UI.dec(repro.mediaDesmamados, 1) : '—', foot: 'por parto desmamado' }) +
          V.kpi({ label: 'Taxa de desmame', icon: '✅', accent: 'a-green', value: isFinite(repro.taxaDesmame) ? UI.pct(repro.taxaDesmame) : '—', foot: 'desmamados / nascidos vivos' }) +
        '</section>' +

        '<div class="toolbar">' +
          '<label class="search"><span aria-hidden="true">🔍</span><input id="pt-busca" type="search" placeholder="Buscar matriz, lote…" value="' + UI.esc(ptFilters.busca) + '"></label>' +
          (anos.length > 1
            ? '<select class="filter" id="pt-ano" aria-label="Filtrar por ano"><option value="">Todos os anos</option>' +
              anos.map(a => '<option value="' + a + '"' + (ptFilters.ano === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>'
            : '') +
          '<div class="grow"></div>' +
          '<button class="btn btn-primary" id="pt-novo">＋ Registrar parto</button>' +
        '</div>' +

        '<div class="card">' +
          (lista.length
            ? '<div class="table-wrap"><table class="data"><thead><tr>' +
              '<th>Data</th><th>Matriz</th><th class="num">Nascidos</th><th class="num">Vivos</th><th class="num">Natim.</th>' +
              '<th class="num">Mumif.</th><th class="num">Peso nasc.</th><th>Desmame</th><th class="num">Desmam.</th><th>Lote</th><th></th></tr></thead><tbody>' +
              lista.map(p =>
                '<tr>' +
                '<td class="nowrap">' + UI.fmtDate(p.data) + '</td>' +
                '<td><strong>' + UI.esc(p.matriz_brinco || '—') + '</strong></td>' +
                '<td class="num">' + UI.int(p.nascidos) + '</td>' +
                '<td class="num">' + UI.int(p.nascidos_vivos) + '</td>' +
                '<td class="num">' + (p.natimortos ? '<span style="color:var(--red-600)">' + UI.int(p.natimortos) + '</span>' : '0') + '</td>' +
                '<td class="num">' + (p.mumificados ? UI.int(p.mumificados) : '0') + '</td>' +
                '<td class="num">' + (p.peso_nascimento ? UI.dec(p.peso_nascimento, 2) + ' kg' : '—') + '</td>' +
                '<td class="nowrap small">' + (p.data_desmame ? UI.fmtDate(p.data_desmame) : '<span class="badge badge-amber">pendente</span>') + '</td>' +
                '<td class="num">' + (p.desmamados ? UI.int(p.desmamados) : '—') + '</td>' +
                '<td class="small">' + UI.esc(p.lote_codigo || '—') + '</td>' +
                '<td><div class="row-actions">' +
                  '<button class="btn btn-sm" data-pt-edit="' + p.id + '">Editar</button>' +
                  '<button class="btn btn-sm btn-danger" data-pt-del="' + p.id + '">✕</button>' +
                '</div></td></tr>').join('') +
              '</tbody></table></div>'
            : UI.emptyState('🍼', 'Nenhum parto registrado',
                'Registre os partos para calcular leitões por parto, taxa de desmame e produtividade do plantel.',
                '<button class="btn btn-primary" data-novo-pt>＋ Registrar primeiro parto</button>')) +
        '</div>';

      el.querySelector('#pt-busca').addEventListener('input', (e) => { ptFilters.busca = e.target.value; App.rerender(); });
      const selAno = el.querySelector('#pt-ano');
      if (selAno) selAno.addEventListener('change', (e) => { ptFilters.ano = e.target.value; App.rerender(); });
      el.querySelector('#pt-novo').addEventListener('click', () => openPartoForm());
      const alt = el.querySelector('[data-novo-pt]');
      if (alt) alt.addEventListener('click', () => openPartoForm());
      el.querySelectorAll('[data-pt-edit]').forEach(b => b.addEventListener('click', () => openPartoForm(API.byId('partos', b.dataset.ptEdit))));
      el.querySelectorAll('[data-pt-del]').forEach(b => b.addEventListener('click', () => V.confirmDelete('partos', b.dataset.ptDel, 'parto')));
    }
  });

  function openPartoForm(parto, matrizId) {
    const edit = !!parto;
    const opts = V.matrizOptions();
    if (!opts.length) {
      UI.toast('Cadastre uma matriz antes de registrar partos', 'err');
      return;
    }

    UI.formModal({
      title: edit ? 'Editar parto' : 'Registrar parto',
      subtitle: edit ? 'Brinco ' + (parto.matriz_brinco || '') : 'Nascimentos e desmame',
      wide: true,
      fields: [
        { name: 'data', label: 'Data do parto', type: 'date', required: true, value: edit ? UI.dateInput(parto.data) : UI.today() },
        { name: 'matriz_id', label: 'Matriz', type: 'select', required: true, value: edit ? parto.matriz_id : (matrizId || ''), options: opts },
        { name: 'nascidos', label: 'Total nascidos', type: 'number', required: true, min: 0, value: edit ? parto.nascidos : '' },
        { name: 'nascidos_vivos', label: 'Nascidos vivos', type: 'number', min: 0, value: edit ? parto.nascidos_vivos : '' },
        { name: 'natimortos', label: 'Natimortos', type: 'number', min: 0, value: edit ? parto.natimortos : 0 },
        { name: 'mumificados', label: 'Mumificados', type: 'number', min: 0, value: edit ? parto.mumificados : 0 },
        { name: 'peso_nascimento', label: 'Peso médio ao nascer (kg)', type: 'number', min: 0, value: edit ? parto.peso_nascimento : '' },
        { name: 'data_desmame', label: 'Data do desmame', type: 'date', value: edit ? UI.dateInput(parto.data_desmame) : '' },
        { name: 'desmamados', label: 'Leitões desmamados', type: 'number', min: 0, value: edit ? parto.desmamados : '' },
        { name: 'peso_desmame', label: 'Peso médio ao desmame (kg)', type: 'number', min: 0, value: edit ? parto.peso_desmame : '' },
        { name: 'lote_codigo', label: 'Código do lote gerado', type: 'text', value: edit ? parto.lote_codigo : '', placeholder: 'Ex.: L-2026-03' },
        { name: 'observacoes', label: 'Observações', type: 'textarea', full: true, value: edit ? parto.observacoes : '' }
      ],
      submitLabel: edit ? 'Salvar alterações' : 'Registrar parto',
      onSubmit: async (data, ctx) => {
        const matriz = API.byId('matrizes', data.matriz_id);
        data.matriz_brinco = matriz ? (matriz.brinco || '') : '';
        if (data.nascidos_vivos === null && data.nascidos !== null) {
          data.nascidos_vivos = Math.max(UI.n0(data.nascidos) - UI.n0(data.natimortos) - UI.n0(data.mumificados), 0);
        }
        await API.save('partos', edit ? parto.id : null, data);

        // Atualiza a matriz com os dados do último parto
        if (matriz && !edit) {
          const patch = {
            ultimo_parto: data.data,
            ordem_parto: UI.n0(matriz.ordem_parto) + 1,
            leitoes_nascidos: UI.n0(data.nascidos_vivos),
            fase: data.data_desmame ? 'Vazia' : 'Lactante'
          };
          if (data.data_desmame) patch.leitoes_desmamados = UI.n0(data.desmamados);
          // Próximo parto previsto: nova cobertura a partir do desmame
          if (data.data_desmame) {
            const prev = UI.addDays(data.data_desmame, 115 + 7);
            if (prev) patch.data_parto_previsto = UI.dateInput(prev);
          }
          await API.save('matrizes', matriz.id, patch);
          await API.reload('matrizes');
        }

        ctx.close();
        UI.toast(edit ? 'Parto atualizado' : 'Parto registrado', 'ok');
        App.rerender();
      }
    });
  }

  window.Stats = { openPartoForm, openMatrizForm, openLoteForm: V.openLoteForm, openManejoForm: V.openManejoForm };
})();
