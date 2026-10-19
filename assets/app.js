/* Compizzo Admin — dados em assets/data.json (base) + alterações locais (localStorage / IndexedDB). */
'use strict';
const LS = 'compizzo.state';
const COMPS = ['Qualidade','Retrabalho','Organização','Produtividade','Comprometimento','Orientações','Confiabilidade','Liderança'];
const $ = (s, r = document) => r.querySelector(s);
const brl = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const num = n => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fdate = d => (d ? d.split('-').reverse().join('/') : '—');
const uid = p => p + Math.random().toString(36).slice(2, 8);
const parseBR = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/(\d)\s*(mm|cm|m|l|g|un)\b/g, '$1$2').replace(/["'`´’]/g, '').replace(/[^a-z0-9 ,.]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'para', 'p', 'e', 'a', 'o', 'un', 'und', 'tam']);
const toks = s => norm(s).split(' ').filter(w => w && !STOP.has(w)).map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
const ALIAS = [[/fita grossa/, 'Fita 48mm'], [/fita fina/, 'Fita 24mm'], [/^lona\b/, 'Lona 110M'], [/rolo (de )?5 ?(mm|cm)/, 'Rolo 5CM'], [/rolo (de )?9 ?(mm|cm)/, 'Rolo 9CM'],
  [/^trena/, 'Trena 5M'], [/oculos/, 'Óculos de proteção'], [/mascara.*(filtro)/, 'Kit Máscaras com 2 filtros'], [/mascara pff2/, 'Máscaras PFF2'], [/^galocha/, 'Galochas'], [/^macac/, 'Macacões'], [/^desempenadeira/, 'Desempenadeiras']];

let S, view = 'today', obraF = 'all', tab = {};

/* ---------- persistência ---------- */
async function load() {
  const base = await (await fetch('assets/data.json?v=' + Date.now())).json();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
  S = saved && saved.version === base.version ? saved : base;
}
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { alert('Não foi possível salvar localmente.'); } };
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('compizzo', 1); r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function putFile(f) { const id = uid('f'); const db = await idb(); await new Promise(r => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put({ id, name: f.name, type: f.type, blob: f }); t.oncomplete = r; }); return { id, name: f.name, type: f.type, date: today() }; }
async function openFile(id) { const db = await idb(); db.transaction('files').objectStore('files').get(id).onsuccess = e => { const r = e.target.result; if (r) window.open(URL.createObjectURL(r.blob), '_blank'); else alert('Arquivo não encontrado neste navegador.'); }; }

/* ---------- regras de negócio ---------- */
const stat = m => (m.qtd <= 0 ? 'zero' : m.qtd <= m.critica ? 'crit' : 'ok');
const statPill = m => ({ zero: '<span class="pill r">Sem estoque</span>', crit: '<span class="pill a">Crítico</span>', ok: '<span class="pill g">OK</span>' }[stat(m)]);
const obraNome = id => (S.obras.find(o => o.id === id) || {}).nome || '—';
function classify(n) { return n >= 90 ? 'Excelente' : n >= 80 ? 'Muito Bom' : n >= 70 ? 'Bom' : n >= 60 ? 'Regular' : 'Atenção'; }
const classCss = c => ({ Excelente: 'g', 'Muito Bom': 'g', Bom: 'b', Regular: 'a', Atenção: 'r' }[c]);
function calcNota(notas, faltas, atrasos) {
  const v = Object.values(notas).flat().filter(x => x !== '' && x != null && !isNaN(x)).map(Number);
  if (!v.length) return null;
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  const nota = Math.max(0, Math.round((media * 10 - faltas * 5 - atrasos) * 10) / 10);
  return { media, nota, cls: classify(nota) };
}
function matchMat(q) {
  const nq = norm(q);
  for (const [re, nome] of ALIAS) if (re.test(nq)) { const m = S.materiais.find(x => x.nome === nome); if (m) return m; }
  const qt = toks(q); if (!qt.length) return null;
  let best = null, bs = 0;
  for (const m of S.materiais) {
    const mt = toks(m.nome); const inter = qt.filter(t => mt.includes(t)).length;
    let sc = (2 * inter) / (qt.length + mt.length);
    if (qt.some(t => /^\d+[a-z]*$/.test(t) && !mt.includes(t))) sc *= 0.5; // grão/medida diferente = outro item
    if (sc > bs) { bs = sc; best = m; }
  }
  return bs >= 0.5 ? best : null;
}
function findObra(name) {
  const n = norm(name || ''); if (!n) return null;
  return S.obras.find(o => norm(o.nome) === n) || S.obras.find(o => norm(o.nome).includes(n) || n.includes(norm(o.nome))) || null;
}
const retiradasF = () => S.retiradas.filter(r => obraF === 'all' || r.obraId === obraF);
function boletoInfo(b) {
  const soma = b.parcelas.reduce((a, p) => a + p.valor, 0);
  const compra = S.compras.find(c => c.id === b.compraId);
  const nfOk = Math.abs(soma - b.totalNF) < 0.015;
  const abertas = b.parcelas.filter(p => !p.pago);
  const prox = abertas.map(p => p.venc).sort()[0];
  const dias = prox ? Math.round((new Date(prox) - new Date(today())) / 864e5) : null;
  return { soma, compra, nfOk, dif: compra ? compra.total - b.totalNF : null, prox, dias, pago: b.parcelas.filter(p => p.pago).reduce((a, p) => a + p.valor, 0) };
}

/* ---------- UI base ---------- */
const NAV = [['today', 'Hoje'], ['obras', 'Obras'], ['estoque', 'Estoque'], ['prod', 'Produção e RDO'], ['compras', 'Compras e orçamentos'], ['boletos', 'Boletos'], ['mao', 'Mão de obra']];
const EXT = { click: [], input: [], change: [] }, CAD = {}, PROD = {};
function renderNav() {
  const al = S.materiais.filter(m => stat(m) !== 'ok').length;
  $('#nav').innerHTML = NAV.map(([k, l]) => `<button data-nav="${k}" class="${view === k ? 'on' : ''}">${l}${k === 'estoque' && al ? `<span class="pill r badge">${al}</span>` : ''}</button>`).join('');
  $('#obraSel').innerHTML = `<option value="all">Todas as obras</option>` + S.obras.map(o => `<option value="${o.id}" ${o.id === obraF ? 'selected' : ''}>${esc(o.nome)}</option>`).join('');
}
function render() { renderNav(); $('#view').innerHTML = VIEWS[view](); }
function modal(html) { $('#mbox').innerHTML = html; $('#modal').hidden = false; }
const closeModal = () => { $('#modal').hidden = true; };
const head = (title, sub, actions = '') => `<div class="top"><div><div class="mono">${esc(sub)}</div><h1>${title}</h1></div><div class="row">${actions}</div></div>`;

/* ---------- views ---------- */
const VIEWS = {
  today() {
    const h = new Date().getHours(); const hi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const ms = S.materiais, zero = ms.filter(m => stat(m) === 'zero'), crit = ms.filter(m => stat(m) === 'crit'), ok = ms.length - zero.length - crit.length;
    const pct = ms.length ? (ok / ms.length * 100) : 0;
    const ticks = [...ms].sort((a, b) => ({ ok: 0, crit: 1, zero: 2 }[stat(a)] - { ok: 0, crit: 1, zero: 2 }[stat(b)])).map(m => `<i class="${{ ok: '', crit: 'a', zero: 'r' }[stat(m)]}" title="${esc(m.nome)}"></i>`).join('');
    const rh = retiradasF().filter(r => r.data === today());
    const gasto = S.compras.reduce((a, c) => a + c.total, 0);
    const bol = S.boletos.map(b => ({ b, i: boletoInfo(b) })).filter(x => x.i.prox).sort((a, b) => a.i.prox.localeCompare(b.i.prox));
    const alertList = [...zero, ...crit].slice(0, 8).map(m => `<div class="it"><div class="t"><b>${esc(m.nome)}</b><small>${num(m.qtd)} ${esc(m.unidade)} · crítico ≤ ${m.critica}</small></div>${statPill(m)}</div>`).join('') || '<p class="sub">Nenhum alerta. 🎉</p>';
    return `${head(`${hi}, Compizzo`, new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), `<button class="btn pri" data-act="retirada">Nova retirada</button>`)}
    <p class="sub">${zero.length + crit.length} itens pedem reposição · ${rh.length} retiradas hoje · ${S.obras.length} obras ativas</p>
    <div class="card grid" style="grid-template-columns:minmax(150px,220px) 1fr"><div class="kpi big"><div class="mono">Estoque saudável</div><div class="v">${pct.toFixed(1).replace('.', ',')}<small style="font-size:.4em;color:var(--mut)">%</small></div></div>
      <div><div class="grid g4"><div class="kpi"><div class="mono">Itens</div><div class="v">${ms.length}</div></div><div class="kpi"><div class="mono">OK</div><div class="v">${ok}</div></div><div class="kpi"><div class="mono">Críticos</div><div class="v amb">${crit.length}</div></div><div class="kpi"><div class="mono">Sem estoque</div><div class="v red">${zero.length}</div></div></div>
      <div class="ticks">${ticks}</div><div class="legend"><span>▌ Em estoque</span><span class="amb">▌ Crítico</span><span class="red">▌ Zerado</span><span>Cada marca é um material</span></div></div></div>
    <div class="grid g2"><div class="card"><div class="row sp"><h2>Alertas de estoque</h2><button class="btn sm" data-nav="estoque">Ver estoque</button></div><div class="list">${alertList}</div></div>
      <div><div class="card"><div class="mono">Gasto em compras</div><div class="kpi"><div class="v">${brl(gasto)}</div></div><small class="sub">${S.compras.length} fornecedores · informado ${brl(S.totalInformado)} ${Math.abs(gasto - S.totalInformado) < .02 ? '<span class="ok">✓ confere</span>' : '<span class="bad">≠ diverge</span>'}</small></div>
      ${metaCard()}<div class="card"><h2>Boletos a vencer</h2><div class="list">${bol.map(({ b, i }) => `<div class="it"><div class="t"><b>${esc(b.fornecedor)} · NF ${esc(b.nf)}</b><small>próx. venc. ${fdate(i.prox)}</small></div><span class="pill ${i.dias < 0 ? 'r' : i.dias <= 7 ? 'a' : ''}">${i.dias < 0 ? 'vencido' : 'em ' + i.dias + ' d'}</span></div>`).join('') || '<p class="sub">Sem boletos abertos.</p>'}</div></div></div></div>
    <div class="card"><h2>Últimas retiradas</h2>${retiradasTable(retiradasF().slice(-8).reverse())}</div>`;
  },
  obras() {
    const rows = S.obras.map(o => {
      const rs = S.retiradas.filter(r => r.obraId === o.id); const fs = S.funcionarios.filter(f => f.obraId === o.id);
      const av = S.avaliacoes.filter(a => a.obraId === o.id); const med = av.length ? av.reduce((a, x) => a + x.nota, 0) / av.length : null;
      return `<tr><td><b>${esc(o.nome)}</b></td><td>${esc(o.status)}</td><td class="n">${rs.length}</td><td class="n">${rs.reduce((a, r) => a + r.qtd, 0)}</td><td class="n">${fs.length}</td><td class="n">${med == null ? '—' : med.toFixed(1)}</td></tr>`;
    }).join('');
    const sel = obraF !== 'all' ? Object.entries(S.retiradas.filter(r => r.obraId === obraF).reduce((m, r) => (m[r.materialId] = (m[r.materialId] || 0) + r.qtd, m), {})) : [];
    return `${head('Obras', 'Gestão', '<button class="btn pri" data-act="novaObra">Nova obra</button>')}<p class="sub">Todas as retiradas do estoque central são atribuídas a uma obra.</p>
    <div class="card tw"><table><tr><th>Obra</th><th>Status</th><th class="n">Retiradas</th><th class="n">Unidades retiradas</th><th class="n">Equipe</th><th class="n">Nota média</th></tr>${rows}</table></div>
    ${obraF !== 'all' ? `<div class="card"><h2>Materiais consumidos · ${esc(obraNome(obraF))}</h2><table>${sel.map(([id, q]) => `<tr><td>${esc((S.materiais.find(m => m.id === id) || {}).nome)}</td><td class="n">${num(q)}</td></tr>`).join('') || '<tr><td>Sem retiradas.</td></tr>'}</table></div>` : ''}`;
  },
  estoque() {
    const q = norm(tab.q || ''), f = tab.fs || 'all';
    const list = S.materiais.filter(m => (!q || norm(m.nome).includes(q)) && (f === 'all' || (f === 'alert' ? stat(m) !== 'ok' : stat(m) === f)));
    const rows = list.map(m => { const p = Math.min(100, m.critica ? m.qtd / (m.critica * 3) * 100 : 100); return `<tr><td><b>${esc(m.nome)}</b>${m.nota ? `<small style="display:block;color:var(--mut)">${esc(m.nota)}</small>` : ''}</td><td class="mono">${esc(m.codigo || '')}</td><td class="n"><b>${num(m.qtd)}</b> ${esc(m.unidade)}</td><td><div class="bar ${stat(m) === 'zero' ? 'r' : stat(m) === 'crit' ? 'a' : ''}"><i style="width:${p}%"></i></div></td><td class="n"><input type="number" min="0" value="${m.critica}" data-crit="${m.id}" style="width:70px"></td><td>${statPill(m)}</td></tr>`; }).join('');
    return `${head('Estoque', 'Depósito 3 · central', `<button class="btn" data-act="contagem">Importar lista/contagem</button><button class="btn pri" data-act="retirada">Nova retirada</button>`)}
    <div class="row" style="margin-bottom:12px"><input id="q" placeholder="Buscar material…" value="${esc(tab.q || '')}"><div class="tabs" style="margin:0">${[['all', 'Todos'], ['alert', 'Alertas'], ['zero', 'Sem estoque'], ['crit', 'Críticos']].map(([k, l]) => `<button data-fs="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card tw"><table><tr><th>Material</th><th>Código</th><th class="n">Qtd</th><th>Nível</th><th class="n">Alerta ≤</th><th>Status</th></tr>${rows}</table></div>
    <div class="card"><h2>Pedidos planejados</h2><div class="tw"><table><tr><th>Produto</th><th class="n">Qtd</th><th>Un.</th><th>Obs</th></tr>${S.pedidos.map(p => `<tr><td>${esc(p.produto)}</td><td class="n">${p.qtd}</td><td>${esc(p.unidade)}</td><td>${esc(p.obs || '')}</td></tr>`).join('')}</table></div></div>
    <div class="card"><h2>Histórico de retiradas</h2>${retiradasTable(retiradasF().slice().reverse())}</div>
    ${S.ajustes.length ? `<div class="card"><h2>Ajustes de contagem</h2><div class="tw"><table><tr><th>Data</th><th>Material</th><th class="n">De</th><th class="n">Para</th></tr>${S.ajustes.slice().reverse().slice(0, 60).map(a => `<tr><td>${fdate(a.data)}</td><td>${esc(a.nome)}</td><td class="n">${num(a.de)}</td><td class="n">${num(a.para)}</td></tr>`).join('')}</table></div></div>` : ''}`;
  },
  compras() {
    const t = tab.c || 'compras', soma = S.compras.reduce((a, c) => a + c.total, 0);
    let body;
    if (t === 'compras') {
      body = `<div class="card row sp"><div><div class="mono">Valor total das compras</div><div class="kpi"><div class="v">${brl(soma)}</div></div></div><div>${Math.abs(soma - S.totalInformado) < .02 ? `<span class="pill g">Soma confere com ${brl(S.totalInformado)}</span>` : `<span class="pill r">Soma ${brl(soma)} ≠ informado ${brl(S.totalInformado)}</span>`}</div></div>
      <div class="grid g3">${S.compras.map(c => { const bs = S.boletos.filter(b => b.compraId === c.id); return `<div class="card"><div class="row sp"><h2>${esc(c.fornecedor)}</h2><b>${brl(c.total)}</b></div><div class="mono" style="margin:6px 0">${(c.total / soma * 100).toFixed(1)}% do total${bs.length ? ' · ' + bs.length + ' boleto(s)' : ''}</div><ul style="margin:0;padding-left:18px;color:var(--mut);font-size:13px">${c.itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`; }).join('')}</div>`;
    } else {
      const rows = S.cotacoes.map(c => { const v = c.precos.filter(x => x != null).sort((a, b) => a - b); const min = v[0], sec = v[1], max = v[v.length - 1];
        return `<tr><td><b>${esc(c.material)}</b></td>${c.precos.map(p => `<td class="n ${p == null ? '' : p === min ? 'best' : p === sec ? 'second' : p === max ? 'worst' : ''}">${p == null ? '–' : brl(p)}</td>`).join('')}<td class="n">${v.length > 1 ? brl(max - min) : '—'}</td></tr>`; }).join('');
      body = `<div class="card tw"><table><tr><th>Material</th>${S.fornecedores.map(f => `<th class="n">${esc(f)}</th>`).join('')}<th class="n">Diferença</th></tr>${rows}</table><div class="legend"><span class="grn">■ Melhor preço</span><span class="amb">■ 2º melhor</span><span class="red">■ Mais caro</span></div></div>`;
    }
    return `${head('Compras e orçamentos', 'Comparativo', '<button class="btn pri" data-act="importCompras">Importar compras</button>')}<div class="tabs"><button data-ct="compras" class="${t === 'compras' ? 'on' : ''}">Compras</button><button data-ct="comp" class="${t === 'comp' ? 'on' : ''}">Comparativo de preços</button></div>${body}`;
  },
  boletos() {
    return `${head('Boletos', 'Contas a pagar', '<button class="btn pri" data-act="novoBoleto">Novo boleto</button>')}<p class="sub">Cruzamos parcelas × nota fiscal × compra do orçamento. PDFs e imagens ficam no histórico (neste navegador).</p>
    ${S.boletos.map(b => { const i = boletoInfo(b); return `<div class="card"><div class="row sp"><div><h2>${esc(b.fornecedor)} · NF ${esc(b.nf)}</h2><div class="mono">emissão ${fdate(b.emissao)} · total NF ${brl(b.totalNF)}</div></div><div class="row"><label class="btn sm">Anexar PDF/imagem<input type="file" accept="application/pdf,image/*" multiple hidden data-up="${b.id}"></label></div></div>
      <div class="grid g3" style="margin:12px 0"><div class="alert" style="background:var(--soft);border-color:var(--line)"><div class="mono">Σ parcelas × NF</div>${i.nfOk ? `<b class="ok">✓ ${brl(i.soma)} confere</b>` : `<b class="bad">✗ ${brl(i.soma)} ≠ ${brl(b.totalNF)} (dif ${brl(i.soma - b.totalNF)})</b>`}</div>
        <div class="alert" style="background:var(--soft);border-color:var(--line)"><div class="mono">NF × orçamento (${esc(i.compra ? i.compra.fornecedor : '—')})</div>${i.compra ? (Math.abs(i.dif) < .02 ? '<b class="ok">✓ igual</b>' : `<b class="amb">Orçado ${brl(i.compra.total)} · NF ${brl(b.totalNF)} → falta ${brl(i.dif)} (entrega parcial?)</b>`) : 'sem compra vinculada'}</div>
        <div class="alert" style="background:var(--soft);border-color:var(--line)"><div class="mono">Pago / em aberto</div><b>${brl(i.pago)}</b> / <b>${brl(i.soma - i.pago)}</b></div></div>
      <table><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th><th>Situação</th></tr>${b.parcelas.map((p, k) => { const d = Math.round((new Date(p.venc) - new Date(today())) / 864e5); return `<tr><td>${p.n}/${b.parcelas.length}</td><td>${fdate(p.venc)}</td><td class="n">${brl(p.valor)}</td><td>${p.pago ? '<span class="pill g">Pago</span>' : `<span class="pill ${d < 0 ? 'r' : d <= 7 ? 'a' : ''}">${d < 0 ? 'Vencido' : 'Em ' + d + ' d'}</span>`} <button class="btn sm" data-pay="${b.id}:${k}">${p.pago ? 'Desfazer' : 'Marcar pago'}</button></td></tr>`; }).join('')}</table>
      ${b.obs ? `<p class="sub" style="margin-top:10px">${esc(b.obs)}</p>` : ''}
      <div class="row" style="margin-top:8px"><span class="mono">Arquivos</span>${(b.arquivos || []).map(a => `<button class="btn sm" data-open="${a.id}">📎 ${esc(a.name)} · ${fdate(a.date)}</button>`).join('') || '<small class="sub" style="margin:0">nenhum anexado</small>'}</div></div>`; }).join('') || '<div class="dz">Sem boletos.</div>'}`;
  },
  mao() {
    const t = tab.m || 'ranking', funcs = S.funcionarios.filter(f => obraF === 'all' || f.obraId === obraF);
    let body;
    if (t === 'ranking') {
      const rk = funcs.map(f => { const av = S.avaliacoes.filter(a => a.funcId === f.id).sort((a, b) => a.periodo.localeCompare(b.periodo)); return { f, last: av[av.length - 1], n: av.length }; }).sort((a, b) => (b.last?.nota ?? -1) - (a.last?.nota ?? -1));
      body = `<div class="card tw"><table><tr><th>#</th><th>Funcionário</th><th>Obra</th><th>Último período</th><th class="n">Faltas</th><th class="n">Atrasos</th><th class="n">Nota</th><th>Classificação</th><th class="n">Avaliações</th></tr>${rk.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.f.nome)}</b></td><td>${esc(obraNome(r.f.obraId))}</td><td>${r.last ? esc(r.last.periodo) : '—'}</td><td class="n">${r.last?.faltas ?? '—'}</td><td class="n">${r.last?.atrasos ?? '—'}</td><td class="n"><b>${r.last ? r.last.nota.toFixed(1) : '—'}</b></td><td>${r.last ? `<span class="pill ${classCss(r.last.cls)}">${r.last.cls}</span>` : '<span class="pill">Sem avaliação</span>'}</td><td class="n">${r.n}</td></tr>`).join('') || '<tr><td>Sem funcionários.</td></tr>'}</table></div>
      <div class="card"><h2>Histórico</h2><div class="tw"><table><tr><th>Período</th><th>Funcionário</th><th>Obra</th><th class="n">Média</th><th class="n">Faltas</th><th class="n">Atrasos</th><th class="n">Nota final</th><th>Classificação</th></tr>${S.avaliacoes.filter(a => funcs.some(f => f.id === a.funcId)).slice().reverse().map(a => `<tr><td>${esc(a.periodo)}</td><td>${esc((S.funcionarios.find(f => f.id === a.funcId) || {}).nome)}</td><td>${esc(obraNome(a.obraId))}</td><td class="n">${a.media.toFixed(2)}</td><td class="n">${a.faltas}</td><td class="n">${a.atrasos}</td><td class="n"><b>${a.nota.toFixed(1)}</b></td><td><span class="pill ${classCss(a.cls)}">${a.cls}</span></td></tr>`).join('') || '<tr><td>Nenhuma avaliação ainda.</td></tr>'}</table></div></div>`;
    } else if (CAD[t]) { body = CAD[t](); }
    else {
      const av = S.avaliadores; const d = new Date(); const q = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getDate() <= 15 ? '1ª' : '2ª'} quinzena`;
      body = `<div class="card"><div class="grid g3"><div><label class="mono">Funcionário</label><br><select id="aF">${S.funcionarios.map(f => `<option value="${f.id}">${esc(f.nome)} — ${esc(obraNome(f.obraId))}</option>`).join('')}</select></div><div><label class="mono">Período</label><br><input id="aP" value="${q}" style="width:100%"></div><div class="row"><div><label class="mono">Faltas</label><br><input id="aFa" type="number" min="0" value="0" style="width:90px"></div><div><label class="mono">Atrasos</label><br><input id="aAt" type="number" min="0" value="0" style="width:90px"></div></div></div>
      <p class="sub" style="margin-top:14px">Notas de 0 a 10 por competência. Nota final = média ×10 − faltas×5 − atrasos.</p>
      <div class="tw"><table><tr><th>Competência</th>${av.map(a => `<th class="n">${esc(a)}</th>`).join('')}</tr>${COMPS.map((c, i) => `<tr><td>${c}</td>${av.map((a, j) => `<td class="n"><input class="sc" data-c="${i}" data-a="${j}" type="number" min="0" max="10" step="0.5" style="width:80px"></td>`).join('')}</tr>`).join('')}</table></div>
      <div class="row sp" style="margin-top:14px"><div id="prev" class="kpi"><div class="mono">Resultado</div><div class="v">—</div></div><button class="btn blue" data-act="saveAval">Salvar avaliação</button></div></div>`;
    }
    return `${head('Mão de obra', 'Avaliação de desempenho · quinzenal', `<button class="btn" data-mt="func">Cadastros</button>`)}<div class="tabs">${[['ranking', 'Ranking e histórico'], ['aval', 'Nova avaliação'], ['func', 'Funcionários'], ['equipes', 'Equipes'], ['cargos', 'Cargos']].map(([k, l]) => `<button data-mt="${k}" class="${t === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}`;
  }
};
function retiradasTable(rs) {
  if (!rs.length) return '<p class="sub">Nenhuma retirada registrada ainda.</p>';
  return `<div class="tw"><table><tr><th>Data</th><th>Material</th><th class="n">Qtd</th><th>Obra</th><th>Obs</th></tr>${rs.map(r => `<tr><td>${fdate(r.data)}</td><td>${esc((S.materiais.find(m => m.id === r.materialId) || {}).nome || r.nomeOriginal)}</td><td class="n">${num(r.qtd)}</td><td>${esc(obraNome(r.obraId))}</td><td>${r.faltou ? `<span class="pill r">faltou ${num(r.faltou)}</span>` : esc(r.obs || '')}</td></tr>`).join('')}</table></div>`;
}

/* ---------- ações / modais ---------- */
const matOpts = sel => S.materiais.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.nome)} (${num(m.qtd)})</option>`).join('');
const obraOpts = sel => S.obras.map(o => `<option value="${o.id}" ${o.id === sel ? 'selected' : ''}>${esc(o.nome)}</option>`).join('');
function parseRetiradas(txt) {
  const out = [];
  for (const blk of txt.split(/RETIRADA DE ESTOQUE/i).slice(1).length ? txt.split(/RETIRADA DE ESTOQUE/i).slice(1) : [txt]) {
    const g = re => (blk.match(re) || [])[1];
    const mat = g(/material:\s*(.+)/i), qt = g(/quantidade:\s*([^\n]+)/i), ob = g(/obra[^:\n]*:\s*(.+)/i);
    if (!mat || !qt) continue;
    const qn = parseBR((qt.match(/[\d.,]+/) || ['0'])[0]);
    const m = matchMat(mat), o = findObra(ob);
    out.push({ mat: mat.trim(), qtd: qn, obraTxt: (ob || '').trim(), m, o });
  }
  return out;
}
function rowHtml(r, i) {
  return `<tr data-i="${i}"><td><select class="rm">${r.m ? '' : '<option value="">— escolher —</option>'}${matOpts(r.m && r.m.id)}</select><small style="color:var(--mut)">${esc(r.mat || '')}</small></td><td><input class="rq" type="number" step="any" value="${r.qtd}" style="width:80px"></td><td><select class="ro">${r.o ? '' : '<option value="">— escolher —</option>'}${obraOpts(r.o && r.o.id)}</select>${r.o ? '' : `<small class="bad">“${esc(r.obraTxt)}” não cadastrada</small>`}</td></tr>`;
}
let draft = [];
function openRetirada() {
  draft = [];
  modal(`<h2>Nova retirada de estoque</h2><label>Cole a mensagem (📦 RETIRADA DE ESTOQUE – COMPIZZO) — pode colar várias</label><textarea id="rt" placeholder="🛠️ Material: Rolo 23cm&#10;📊 Quantidade: 5&#10;🏗️ Obra de destino: Supera"></textarea>
  <div class="row" style="margin-top:10px"><button class="btn" data-act="parseRet">Interpretar</button><button class="btn" data-act="addRow">+ linha manual</button></div><div id="rprev"></div><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="confRet">Confirmar retirada</button></div>`);
}
function drawDraft() { $('#rprev').innerHTML = draft.length ? `<table style="margin-top:10px"><tr><th>Material</th><th>Qtd</th><th>Obra</th></tr>${draft.map(rowHtml).join('')}</table>` : ''; }
function syncDraft() { document.querySelectorAll('#rprev tr[data-i]').forEach(tr => { const r = draft[+tr.dataset.i]; r.m = S.materiais.find(m => m.id === tr.querySelector('.rm').value) || null; r.qtd = parseFloat(tr.querySelector('.rq').value) || 0; r.o = S.obras.find(o => o.id === tr.querySelector('.ro').value) || null; }); }
function confirmRetirada() {
  syncDraft();
  if (!draft.length || draft.some(r => !r.m || !r.o || !(r.qtd > 0))) return alert('Preencha material, quantidade (>0) e obra em todas as linhas.');
  for (const r of draft) {
    const faltou = Math.max(0, r.qtd - r.m.qtd); r.m.qtd = Math.max(0, r.m.qtd - r.qtd);
    S.retiradas.push({ id: uid('r'), data: today(), materialId: r.m.id, qtd: r.qtd, obraId: r.o.id, nomeOriginal: r.mat, faltou: faltou || undefined });
  }
  save(); closeModal(); render();
  const al = draft.filter(r => stat(r.m) !== 'ok').map(r => r.m.nome);
  if (al.length) alert('Atenção — estoque baixo/zerado: ' + al.join(', '));
}
function openContagem() {
  modal(`<h2>Importar lista de materiais</h2><label>Modo</label><select id="cm"><option value="set">Contagem — substitui o saldo</option><option value="add">Entrada — soma ao estoque</option></select><label>Cole a lista (uma linha por item)</label><textarea id="ct" placeholder="Thinner 6&#10;Fita grossa 1cx&#10;8 tecbonds"></textarea><div class="row" style="margin-top:10px"><button class="btn" data-act="parseCont">Interpretar</button></div><div id="cprev"></div><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="confCont">Aplicar</button></div>`);
}
let cdraft = [];
function parseLista(txt) {
  return txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    let qtd, nome, mm;
    if ((mm = l.match(/^(\d+)\s+(.+)$/))) { qtd = +mm[1]; nome = mm[2]; }
    else if ((mm = l.match(/^(.+?)\s+(\d+)\s*(cx|m)?$/i))) { qtd = +mm[2]; nome = mm[1]; }
    else return { l, nome: l, qtd: 0, m: null };
    nome = nome.trim(); return { l, nome, qtd, m: matchMat(nome), criar: true };
  });
}
function drawCont() { $('#cprev').innerHTML = `<table style="margin-top:10px"><tr><th>Linha</th><th>Material</th><th>Qtd</th></tr>${cdraft.map((r, i) => `<tr><td>${esc(r.l)}</td><td>${r.m ? esc(r.m.nome) + ` <small class="ok">atual ${num(r.m.qtd)}</small>` : `<label style="margin:0"><input type="checkbox" data-cc="${i}" ${r.criar ? 'checked' : ''}> criar novo item “${esc(r.nome)}”</label>`}</td><td class="n">${r.qtd}</td></tr>`).join('')}</table>`; }
function applyCont() {
  const mode = $('#cm').value; let n = 0;
  for (const r of cdraft) {
    if (!r.qtd && r.qtd !== 0) continue;
    if (r.m) { const de = r.m.qtd, para = mode === 'add' ? de + r.qtd : r.qtd; r.m.qtd = para; S.ajustes.push({ data: today(), materialId: r.m.id, nome: r.m.nome, de, para }); n++; }
    else if (r.criar && r.qtd > 0) { const m = { id: uid('m'), nome: r.nome[0].toUpperCase() + r.nome.slice(1), codigo: '', unidade: 'un', qtd: r.qtd, critica: 5 }; S.materiais.push(m); S.ajustes.push({ data: today(), materialId: m.id, nome: m.nome, de: 0, para: r.qtd }); n++; }
  }
  save(); closeModal(); render(); alert(n + ' itens atualizados.');
}
function parseCompras(txt) {
  const compras = []; let cur = null, total = null;
  for (const raw of txt.split('\n')) {
    const l = raw.trim(); if (!l) continue; let m;
    if ((m = l.match(/^valor total.*?R\$\s*([\d.,]+)/i))) { total = parseBR(m[1]); continue; }
    if ((m = l.match(/^(.+?)\s*[—–-]\s*R\$\s*([\d.,]+)\s*$/))) { cur = { id: uid('c'), fornecedor: m[1].replace(/^\(/, '').trim(), total: parseBR(m[2]), data: today(), itens: [] }; compras.push(cur); continue; }
    if (cur && /^[*•-]\s+/.test(l)) cur.itens.push(l.replace(/^[*•-]\s+/, ''));
  }
  return { compras, total };
}
const readAsDataless = f => f;

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  for (const fn of EXT.click) if (await fn(e)) return;
  const t = e.target.closest('[data-nav],[data-act],[data-fs],[data-ct],[data-mt],[data-pay],[data-open]'); if (!t) { if (e.target.id === 'modal') closeModal(); return; }
  const d = t.dataset;
  if (d.nav) { view = d.nav; render(); window.scrollTo(0, 0); }
  else if (d.fs) { tab.fs = d.fs; render(); }
  else if (d.ct) { tab.c = d.ct; render(); }
  else if (d.mt) { tab.m = d.mt; render(); }
  else if (d.open) openFile(d.open);
  else if (d.pay) { const [id, k] = d.pay.split(':'); const p = S.boletos.find(b => b.id === id).parcelas[+k]; p.pago = !p.pago; save(); render(); }
  else if (d.act) {
    const a = d.act;
    if (a === 'close') closeModal();
    else if (a === 'retirada') openRetirada();
    else if (a === 'parseRet') { const p = parseRetiradas($('#rt').value); if (!p.length) return alert('Não encontrei Material/Quantidade na mensagem.'); draft = draft.concat(p); drawDraft(); }
    else if (a === 'addRow') { syncDraft(); draft.push({ mat: '', qtd: 1, obraTxt: '', m: null, o: obraF !== 'all' ? S.obras.find(o => o.id === obraF) : null }); drawDraft(); }
    else if (a === 'confRet') confirmRetirada();
    else if (a === 'contagem') { openContagem(); }
    else if (a === 'parseCont') { cdraft = parseLista($('#ct').value); drawCont(); }
    else if (a === 'confCont') applyCont();
    else if (a === 'novaObra') { const n = prompt('Nome da obra:'); if (n) { S.obras.push({ id: uid('o'), nome: n.trim(), status: 'Em andamento' }); save(); render(); } }
    else if (a === 'novoFunc') { const n = prompt('Nome do funcionário:'); if (!n) return; const o = prompt('Obra (' + S.obras.map(o => o.nome).join(', ') + '):', S.obras[0]?.nome); const ob = findObra(o) || S.obras[0]; S.funcionarios.push({ id: uid('f'), nome: n.trim(), obraId: ob.id, funcao: '' }); save(); render(); }
    else if (a === 'importCompras') modal(`<h2>Importar compras</h2><label>Cole o resumo (FORNECEDOR — R$ valor, itens com *, “Valor total das compras”)</label><textarea id="ic"></textarea><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="confCompras">Importar</button></div>`);
    else if (a === 'confCompras') { const { compras, total } = parseCompras($('#ic').value); if (!compras.length) return alert('Nenhum fornecedor reconhecido.'); S.compras.push(...compras); if (total) S.totalInformado = total; else S.totalInformado = S.compras.reduce((x, c) => x + c.total, 0); save(); closeModal(); render(); }
    else if (a === 'novoBoleto') modal(`<h2>Novo boleto</h2><label>Fornecedor</label><select id="bf">${S.compras.map(c => `<option value="${c.id}">${esc(c.fornecedor)} (${brl(c.total)})</option>`).join('')}</select><label>Nº da NF</label><input id="bn"><label>Total da NF (R$)</label><input id="bt" placeholder="2284,47"><label>Parcelas — uma por linha: vencimento(AAAA-MM-DD) valor</label><textarea id="bp" placeholder="2026-10-22 761,49"></textarea><label>Observações</label><input id="bo"><label>Arquivo (PDF/imagem)</label><input id="bfi" type="file" accept="application/pdf,image/*" multiple><div class="row sp" style="margin-top:14px"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" data-act="confBoleto">Salvar</button></div>`);
    else if (a === 'confBoleto') {
      const c = S.compras.find(x => x.id === $('#bf').value); const ps = $('#bp').value.split('\n').map(l => l.trim().match(/^(\d{4}-\d{2}-\d{2})\s+([\d.,]+)/)).filter(Boolean).map((m, i) => ({ n: i + 1, venc: m[1], valor: parseBR(m[2]), pago: false }));
      const tn = parseBR($('#bt').value); if (!ps.length || !(tn > 0)) return alert('Informe total da NF e ao menos uma parcela.');
      const arq = []; for (const f of $('#bfi').files) arq.push(await putFile(f));
      S.boletos.push({ id: uid('b'), fornecedor: c.fornecedor, compraId: c.id, nf: $('#bn').value, emissao: today(), totalNF: tn, parcelas: ps, obs: $('#bo').value, arquivos: arq }); save(); closeModal(); render();
    }
    else if (a === 'saveAval') {
      const f = S.funcionarios.find(x => x.id === $('#aF').value); const r = readAval(); if (!r) return alert('Preencha ao menos uma nota.');
      S.avaliacoes.push({ id: uid('a'), funcId: f.id, obraId: f.obraId, periodo: $('#aP').value, faltas: +$('#aFa').value || 0, atrasos: +$('#aAt').value || 0, notas: r.notas, media: r.media, nota: r.nota, cls: r.cls }); save(); tab.m = 'ranking'; render();
    }
  }
});
function readAval() {
  const notas = {}; document.querySelectorAll('.sc').forEach(i => { (notas[i.dataset.a] = notas[i.dataset.a] || []).push(i.value); });
  return calcNota(notas, +$('#aFa').value || 0, +$('#aAt').value || 0);
}
document.addEventListener('input', e => {
  const t = e.target;
  for (const fn of EXT.input) if (fn(e)) return;
  if (t.id === 'q') { tab.q = t.value; const p = t.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(p, p); }
  else if (t.dataset.crit) { const m = S.materiais.find(x => x.id === t.dataset.crit); m.critica = Math.max(0, +t.value || 0); save(); renderNav(); }
  else if (t.classList.contains('sc') || t.id === 'aFa' || t.id === 'aAt') { const r = readAval(); $('#prev').innerHTML = r ? `<div class="mono">Resultado</div><div class="v">${r.nota.toFixed(1)} <span class="pill ${classCss(r.cls)}">${r.cls}</span></div><small class="sub">média ${r.media.toFixed(2)} → ${(r.media * 10).toFixed(1)} pts</small>` : '<div class="mono">Resultado</div><div class="v">—</div>'; }
});
document.addEventListener('change', async e => {
  const t = e.target;
  for (const fn of EXT.change) if (await fn(e)) return;
  if (t.dataset.up) { const b = S.boletos.find(x => x.id === t.dataset.up); for (const f of t.files) (b.arquivos = b.arquivos || []).push(await putFile(f)); save(); render(); }
  else if (t.dataset.cc) cdraft[+t.dataset.cc].criar = t.checked;
  else if (t.id === 'obraSel') { obraF = t.value; render(); }
});
$('#btnExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = 'compizzo-dados-' + today() + '.json'; a.click(); };
$('#btnReset').onclick = () => { if (confirm('Descartar alterações locais e voltar à base publicada?')) { localStorage.removeItem(LS); location.reload(); } };
function metaCard() { const m = S.metaMensal; if (!m) return ''; return `<div class="card"><div class="mono">Meta de faturamento · ${esc(m.periodo)}</div><div class="kpi"><div class="v">${brl(m.totalBruto)}</div></div><small class="sub">líquido previsto ${brl(m.totalLiquido)} · ${m.obras.length} frentes</small> <button class="btn sm" data-nav="prod" data-goto="mc">Ver</button></div>`; }
