/* Produção e RDO → aba "Desempenho": cobrança semanal, equipes, pessoas, receita, custo e margem. */
'use strict';
const cfgD = () => (S.config = Object.assign({ jornada: 8, encargos: 0, diasMes: 22, impostos: 30, retencao: 5 }, S.config || {}));
const numI = v => (v === '' || v == null ? null : (typeof v === 'number' ? v : parseBR(v)));
const mondayOf = iso => addDays(iso, -dowIdx(iso));
function dSemana() { const t = tab.dw; if (t) return t; const h = today(); return dowIdx(h) === 0 ? addDays(mondayOf(h), -7) : mondayOf(h); }
function dPeriodo() {
  const p = tab.dp || 'sem', w = dSemana();
  if (p === 'sem') return { ini: w, fim: addDays(w, 5), rot: `semana ${fdate(w).slice(0, 5)}–${fdate(addDays(w, 5)).slice(0, 5)}` };
  if (p === 'quin') { const h = today(), d = +h.slice(8), m = h.slice(0, 7); return d <= 15 ? { ini: m + '-01', fim: m + '-15', rot: '1ª quinzena do mês' } : { ini: m + '-16', fim: m + '-31', rot: '2ª quinzena do mês' }; }
  if (p === 'mes') { const m = today().slice(0, 7); return { ini: m + '-01', fim: m + '-31', rot: MESES[+m.slice(5) - 1] }; }
  return { ini: '2000-01-01', fim: '2100-01-01', rot: 'todo o período' };
}
// custo diário de uma pessoa (R$/dia) ou null se não houver taxa
function custoDia(f) {
  const c = cfgD(), cg = S.cargos.find(x => x.nome === f.funcao) || {};
  if (numI(f.custoDiaFixo) != null) return numI(f.custoDiaFixo); // já inclui encargos (ex.: salário + encargos ÷ 22)
  let v = numI(f.diaria) ?? numI(cg.diaria);
  if (v == null) { const h = numI(f.taxaHora) ?? numI(cg.taxaHora); if (h != null) v = h * c.jornada; }
  if (v == null) { const sal = numI(f.salario) ?? numI(cg.salario); if (sal != null) v = sal / c.diasMes; }
  return v == null ? null : v * (1 + c.encargos / 100);
}
function precoM2Obra(o) {
  if (!o) return null; if (o.precoM2 > 0) return o.precoM2;
  return null;
}
// dados por RDO salvo no período
function dRdos(ini, fim) { return S.rdos.filter(r => r.status === 'salvo' && r.obraId && r.data >= ini && r.data <= fim && (obraF === 'all' || r.obraId === obraF)); }
function dPorPessoa(rdos) {
  const m = {};
  rdos.forEach(r => { const nomes = r.maoObra || []; const n = nomes.length || r.pessoas || 0, m2 = rdoCalc(r).m2; nomes.forEach(nm => { const p = (m[nm] = m[nm] || { nome: nm, dias: new Set(), obras: {}, m2: 0, rdos: 0 }); p.dias.add(r.data); p.obras[r.obraId] = (p.obras[r.obraId] || 0) + 1; p.m2 += n ? m2 / n : 0; p.rdos++; }); });
  return Object.values(m).map(p => { const f = findFunc(p.nome), cd = f ? custoDia(f) : null, diasN = p.dias.size; return { ...p, diasN, func: f, custoDia: cd, custo: cd == null ? null : cd * diasN, m2dia: diasN ? p.m2 / diasN : 0 }; });
}
function dFaltas(ini, fim) { const m = {}; (S.faltas || []).filter(x => x.data >= ini && x.data <= fim).forEach(x => (m[x.funcId] = (m[x.funcId] || 0) + 1)); return m; }

/* ----- cobrança semanal ----- */
function planoDia(obraId, d) {
  const es = S.calendario.filter(e => !e.substituidoPor && e.obraId === obraId && e.data === d);
  return es.map(e => `${e.turno && e.turno !== 'dia' ? e.turno + ': ' : ''}${e.parado ? 'PARADO' : e.texto}`).slice(0, 3);
}
function semanaView() {
  const w = dSemana(), dias = [0, 1, 2, 3, 4, 5].map(i => addDays(w, i)), hoje = today();
  const obras = S.obras.filter(o => (obraF === 'all' || o.id === obraF) && obraWindow(o) && obraWindow(o).fim >= w && obraWindow(o).ini <= dias[5] && o.status !== 'Concluída');
  const falt = []; let esp = 0, ok = 0, m2tot = 0;
  const linhas = obras.map(o => { const win = obraWindow(o);
    const cels = dias.map(d => {
      const plano = planoDia(o.id, d), rs = S.rdos.filter(r => r.obraId === o.id && r.data === d), salvo = rs.find(r => r.status === 'salvo'), rasc = rs.find(r => r.status !== 'salvo');
      const exp = d >= win.ini && d <= win.fim && diaUtil(d) && d <= hoje; if (exp) { esp++; if (salvo) ok++; else falt.push({ o, d }); }
      const m2 = salvo ? rdoCalc(salvo).m2 : 0; m2tot += m2;
      const st = salvo ? `<span class="pill g">✔ RDO${m2 ? ' · ' + nfmt(m2) + ' m²' : ''}</span>` : rasc ? '<span class="pill a">◐ rascunho</span>' : exp ? `<button class="cv no" data-cv="new:${o.id}:${d}" style="width:auto;display:inline-block;padding:2px 8px">✖ sem RDO</button>` : d > hoje && diaUtil(d) ? '<span class="pill">a vir</span>' : '<span class="cv na" style="display:inline">▫</span>';
      const qtd = salvo ? (salvo.maoObra || []).length || salvo.pessoas || 0 : 0;
      return `<td style="min-width:150px;vertical-align:top;font-size:12px;background:${S.feriados[d] ? '#fdecea' : dowIdx(d) === 5 ? '#fff2e0' : 'transparent'}">${st}${qtd ? `<small style="display:block;color:var(--mut)">${qtd} pessoa(s)</small>` : ''}<div style="margin-top:4px;color:var(--mut)">${plano.map(esc).join('<br>') || '<i>sem plano</i>'}</div></td>`;
    }).join('');
    return `<tr><td style="min-width:120px"><i class="sw" style="border-color:${obraCor(o.id)};background:${obraCor(o.id)}22"></i><b>${esc(short(o.nome))}</b></td>${cels}</tr>`; }).join('');
  const porObra = {}; falt.forEach(x => (porObra[x.o.id] = porObra[x.o.id] || { o: x.o, d: [] }).d.push(x.d));
  const txt = `Cobrança de RDO — semana ${fdate(w).slice(0, 5)} a ${fdate(dias[5]).slice(0, 5)}\n` + (Object.values(porObra).map(x => `• ${short(x.o.nome)}: sem RDO em ${x.d.map(d => fdate(d).slice(0, 5) + ' (' + DOW[dowIdx(d)] + ')').join(', ')}`).join('\n') || 'Todos os RDOs da semana foram lançados ✔');
  return `<div class="row sp" style="margin-bottom:10px"><div class="row"><button class="btn sm" data-dw="-7">◀ semana anterior</button><b>${fdate(w)} a ${fdate(dias[5])}</b><button class="btn sm" data-dw="7">próxima ▶</button><button class="btn sm" data-dw="0">semana de cobrança</button></div><span class="mono">${ok} de ${esp} RDOs esperados lançados${esp ? ' · ' + (ok / esp * 100).toFixed(0) + '%' : ''} · ${nfmt(m2tot)} m²</span></div>
  <div class="card tw" style="margin-bottom:14px"><table><tr><th>Obra</th>${dias.map(d => `<th>${DOW[dowIdx(d)]} ${fdate(d).slice(0, 5)}${S.feriados[d] ? ' <span class="pill r">feriado</span>' : ''}</th>`).join('')}</tr>${linhas || '<tr><td colspan="7">Nenhuma obra em andamento nesta semana.</td></tr>'}</table><p class="sub" style="margin-top:8px">Cada célula: situação do RDO (✔/◐/✖), m² e pessoas do dia, e abaixo o que estava planejado na agenda/calendário.</p></div>
  <div class="card"><div class="row sp"><h2>Texto para cobrar (copiar e colar no grupo)</h2><button class="btn pri" data-dcopy="1">Copiar</button></div><pre id="dtxt" style="white-space:pre-wrap;font:13px/1.5 var(--mono);background:var(--soft);padding:12px;border-radius:12px;margin:10px 0 0">${esc(txt)}</pre></div>`;
}

/* ----- equipes e pessoas ----- */
function equipesView() {
  const per = dPeriodo(), rdos = dRdos(per.ini, per.fim), pes = dPorPessoa(rdos), falt = dFaltas(per.ini, per.fim);
  const dias = new Set(rdos.map(r => r.data)); const tot = rdos.reduce((a, r) => a + rdoCalc(r).m2, 0);
  // por equipe (obra + líder) = por obra
  const eq = {}; rdos.forEach(r => { const e = (eq[r.obraId] = eq[r.obraId] || { dias: new Set(), m2: 0, pess: 0, rdos: 0, custo: 0, semTaxa: 0 }); const c = rdoCalc(r); e.dias.add(r.data); e.m2 += c.m2; e.rdos++; const nomes = r.maoObra || []; e.pess += nomes.length || r.pessoas || 0; nomes.forEach(n => { const f = findFunc(n), cd = f ? custoDia(f) : null; if (cd == null) e.semTaxa++; else e.custo += cd; }); });
  const eqRows = Object.entries(eq).sort((a, b) => b[1].m2 - a[1].m2).map(([id, e]) => `<tr><td><i class="sw" style="border-color:${obraCor(id)};background:${obraCor(id)}22"></i><b>${esc(short(obraNome(id)))}</b></td><td class="n">${e.dias.size}</td><td class="n">${nfmt(e.m2)}</td><td class="n">${e.dias.size ? nfmt(e.m2 / e.dias.size) : '—'}</td><td class="n">${e.rdos ? (e.pess / e.rdos).toFixed(1).replace('.', ',') : '—'}</td><td class="n">${e.pess ? nfmt(e.m2 / e.pess) : '—'}</td><td class="n">${e.custo ? brl(e.custo) : '<span style="color:var(--mut)">sem taxa</span>'}${e.custo && e.semTaxa ? `<small style="display:block;color:var(--mut)">+${e.semTaxa} p-dia sem taxa</small>` : ''}</td><td class="n">${e.custo && e.m2 ? brl(e.custo / e.m2) : '—'}</td></tr>`).join('');
  const rank = pes.slice().sort((a, b) => b.m2 - a.m2);
  const pRows = rank.map(p => `<tr><td><b>${esc(p.nome)}</b><small style="display:block;color:var(--mut)">${esc((p.func && p.func.funcao) || '—')}</small></td><td>${Object.entries(p.obras).sort((a, b) => b[1] - a[1]).map(([o, n]) => `${esc(short(obraNome(o)))} <small style="color:var(--mut)">(${n})</small>`).join('<br>')}</td><td class="n">${p.diasN}</td><td class="n">${nfmt(p.m2)}</td><td class="n">${nfmt(p.m2dia)}</td><td class="n">${p.func && falt[p.func.id] ? `<span class="bad">${falt[p.func.id]}</span>` : 0}</td><td class="n">${p.custoDia != null ? brl(p.custoDia) : '<span style="color:var(--mut)">sem taxa</span>'}</td><td class="n">${p.custo != null ? brl(p.custo) : '—'}</td><td class="n">${p.custo && p.m2 ? brl(p.custo / p.m2) : '—'}</td></tr>`).join('');
  return `<div class="grid g4" style="margin-bottom:14px"><div class="card kpi" style="margin:0"><div class="mono">m² no período</div><div class="v" style="font-size:28px">${nfmt(tot)}</div><small class="sub">${dias.size} dias com RDO</small></div><div class="card kpi" style="margin:0"><div class="mono">Pessoas com presença</div><div class="v" style="font-size:28px">${pes.length}</div></div><div class="card kpi" style="margin:0"><div class="mono">m² por pessoa-dia</div><div class="v" style="font-size:28px">${(() => { const pd = pes.reduce((a, p) => a + p.diasN, 0); return pd ? nfmt(tot / pd) : '—'; })()}</div></div><div class="card kpi" style="margin:0"><div class="mono">Faltas registradas</div><div class="v" style="font-size:28px">${Object.values(falt).reduce((a, v) => a + v, 0)}</div></div></div>
  <div class="card tw" style="margin-bottom:14px"><h2>Equipes (por obra) — ${esc(per.rot)}</h2><table><tr><th>Equipe / obra</th><th class="n">Dias</th><th class="n">m²</th><th class="n">m²/dia</th><th class="n">Pessoas/dia</th><th class="n">m² por pessoa-dia</th><th class="n">Custo de MO</th><th class="n">R$ MO por m²</th></tr>${eqRows || '<tr><td colspan="8">Sem RDOs no período.</td></tr>'}</table></div>
  <div class="grid g2" style="grid-template-columns:1fr 1.7fr;margin-bottom:14px"><div class="card" style="margin:0"><h2>Ranking — m² atribuídos</h2><div style="margin-top:8px">${hbars(rank.slice(0, 12).map(p => ({ l: p.nome, v: p.m2, c: '#0b3fbf' })), { fmt: v => nfmt(v) + ' m²' })}</div><small class="sub">m² do RDO ÷ pessoas presentes. Sem horas ou m² por pessoa, é a média da equipe no dia.</small></div>
  <div class="card tw" style="margin:0"><h2>Pessoas — ${esc(per.rot)}</h2><table><tr><th>Pessoa</th><th>Obras (RDOs)</th><th class="n">Dias</th><th class="n">m²</th><th class="n">m²/dia</th><th class="n">Faltas</th><th class="n">Custo/dia</th><th class="n">Custo</th><th class="n">R$/m²</th></tr>${pRows || '<tr><td colspan="9">Sem dados.</td></tr>'}</table></div></div>`;
}

/* ----- obras: receita, custo e margem ----- */
function obrasMargemView() {
  const per = dPeriodo(), c = cfgD(), rdos = dRdos(per.ini, per.fim), mm = S.metaMensal;
  const rows = S.obras.map(o => {
    const rs = rdos.filter(r => r.obraId === o.id); if (!rs.length && !(S.caixinha || []).some(x => (x.obras || []).some(y => y.obraId === o.id) && x.data >= per.ini && x.data <= per.fim)) return null;
    const m2 = rs.reduce((a, r) => a + rdoCalc(r).m2, 0), preco = precoM2Obra(o);
    let recFase = rs.reduce((a, r) => a + rdoCalc(r).receita, 0), receita = recFase || (preco ? m2 * preco : null);
    const liq = receita != null ? receita * (1 - (c.impostos + c.retencao) / 100) : null;
    const mat = (S.caixinha || []).filter(x => x.data >= per.ini && x.data <= per.fim).reduce((a, x) => a + ((x.obras || []).filter(y => y.obraId === o.id).reduce((s, y) => s + (y.valor || 0), 0)), 0);
    let mo = 0, semTaxa = 0; rs.forEach(r => (r.maoObra || []).forEach(n => { const f = findFunc(n), cd = f ? custoDia(f) : null; if (cd == null) semTaxa++; else mo += cd; }));
    const custos = mat + mo, lucro = liq != null ? liq - custos : null, meta = mm && mm.obras.find(x => x.obraId === o.id);
    return { o, m2, preco, receita, liq, mat, mo, semTaxa, lucro, margem: liq ? lucro / liq * 100 : null, meta, pessoasDia: rs.reduce((a, r) => a + ((r.maoObra || []).length || r.pessoas || 0), 0) };
  }).filter(Boolean);
  const T = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const tr = rows.map(r => `<tr><td><i class="sw" style="border-color:${obraCor(r.o.id)};background:${obraCor(r.o.id)}22"></i><b>${esc(short(r.o.nome))}</b></td><td class="n">${nfmt(r.m2)}</td><td class="n"><input data-dpreco="${r.o.id}" value="${r.preco ? String(r.preco).replace('.', ',') : ''}" placeholder="R$/m²" style="width:78px;text-align:right"></td><td class="n">${r.receita != null ? brl(r.receita) : '<span style="color:var(--mut)">informe o preço</span>'}</td><td class="n">${r.liq != null ? brl(r.liq) : '—'}</td><td class="n">${brl(r.mat)}</td><td class="n">${r.mo ? brl(r.mo) : '<span style="color:var(--mut)">sem taxa</span>'}${r.mo && r.semTaxa ? `<small style="display:block;color:var(--mut)">+${r.semTaxa} p-dia sem taxa</small>` : ''}</td><td class="n"><b class="${r.lucro == null ? '' : r.lucro >= 0 ? 'ok' : 'bad'}">${r.lucro != null ? brl(r.lucro) : '—'}</b></td><td class="n">${r.margem != null ? r.margem.toFixed(0) + '%' : '—'}</td><td class="n">${r.meta ? brl(r.meta.bruto) : '—'}</td></tr>`).join('');
  return `<div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>Obras — ${esc(per.rot)}</h2><span class="mono">lucro = receita × (1 − ${c.impostos}% impostos − ${c.retencao}% retenção) − material (caixinha) − mão de obra</span></div><table><tr><th>Obra</th><th class="n">m²</th><th class="n">Preço R$/m²</th><th class="n">Receita bruta</th><th class="n">Receita líquida</th><th class="n">Material (caixinha)</th><th class="n">Mão de obra</th><th class="n">Lucro</th><th class="n">Margem</th><th class="n">Meta do mês (bruto)</th></tr>${tr || '<tr><td colspan="10">Sem dados no período.</td></tr>'}
  <tr><td><b>Total</b></td><td class="n"><b>${nfmt(T('m2'))}</b></td><td></td><td class="n"><b>${brl(T('receita'))}</b></td><td class="n"><b>${brl(T('liq'))}</b></td><td class="n"><b>${brl(T('mat'))}</b></td><td class="n"><b>${brl(T('mo'))}</b></td><td class="n"><b>${brl(T('lucro'))}</b></td><td></td><td class="n"><b>${mm ? brl(mm.obras.reduce((a, x) => a + x.bruto, 0)) : '—'}</b></td></tr></table>
  <p class="sub" style="margin-top:8px">O preço por m² é uma <b>média</b> informada por você (um valor por obra). Quando houver preço por fase em “Metas de produção”, ele tem prioridade. Os materiais de orçamento (R$ 12.305,97) e a faturada da Condor ainda não estão rateados por obra, então não entram neste lucro.</p></div>`;
}
function configView() {
  const c = cfgD(), semTaxa = S.cargos.filter(x => numI(x.taxaHora) == null && numI(x.diaria) == null && numI(x.salario) == null);
  const inp = (k, l, v, w = 80) => `<div><label class="mono">${l}</label><br><input data-dcfg="${k}" value="${String(v).replace('.', ',')}" style="width:${w}px"></div>`;
  return `<div class="card" style="margin-bottom:14px"><h2>Regras e custos</h2><div class="row" style="gap:18px;margin:10px 0">${inp('jornada', 'Jornada (h/dia)', c.jornada)}${inp('diasMes', 'Dias úteis/mês', c.diasMes)}${inp('encargos', 'Encargos (%)', c.encargos)}${inp('impostos', 'Impostos (%)', c.impostos)}${inp('retencao', 'Retenção (%)', c.retencao)}</div>
  <div class="tw"><table><tr><th>Cargo</th><th class="n">Diária (R$)</th><th class="n">Taxa horária (R$)</th><th class="n">Salário base (R$)</th><th class="n">Custo/dia usado</th><th class="n">Pessoas</th></tr>${S.cargos.map(cg => { const f = { funcao: cg.nome }, cd = custoDia(f); return `<tr><td><b>${esc(cg.nome)}</b></td><td class="n"><input data-dcargo="${cg.id}:diaria" value="${cg.diaria != null ? String(cg.diaria).replace('.', ',') : ''}" style="width:90px;text-align:right"></td><td class="n"><input data-dcargo="${cg.id}:taxaHora" value="${cg.taxaHora != null ? String(cg.taxaHora).replace('.', ',') : ''}" style="width:90px;text-align:right"></td><td class="n"><input data-dcargo="${cg.id}:salario" value="${cg.salario != null ? String(cg.salario).replace('.', ',') : ''}" style="width:90px;text-align:right"></td><td class="n">${cd != null ? brl(cd) : '<span style="color:var(--mut)">—</span>'}</td><td class="n">${S.funcionarios.filter(f => f.funcao === cg.nome).length}</td></tr>`; }).join('')}</table></div>
  <p class="sub" style="margin-top:8px">Prioridade do custo/dia: diária da pessoa → diária do cargo → taxa horária × jornada → salário ÷ dias úteis. Ajustes individuais ficam em Mão de obra → Funcionários. ${semTaxa.length ? `<span class="amb">${semTaxa.length} cargo(s) ainda sem valor: ${semTaxa.map(x => esc(x.nome)).join(', ')}.</span>` : ''}</p></div>`;
}

function desempenhoView() {
  const sub = tab.ds || 'semana', ps = [['sem', 'Semana'], ['quin', 'Quinzena'], ['mes', 'Mês'], ['all', 'Tudo']], subs = [['semana', 'Cobrança semanal'], ['equipes', 'Equipes e pessoas'], ['obras', 'Obras: receita e margem'], ['config', 'Custos e regras']];
  return `<div class="row sp" style="margin-bottom:12px"><div class="tabs" style="margin:0">${subs.map(([k, l]) => `<button data-ds="${k}" class="${sub === k ? 'on' : ''}">${l}</button>`).join('')}</div>${sub === 'equipes' || sub === 'obras' ? `<div class="tabs" style="margin:0">${ps.map(([k, l]) => `<button data-dp="${k}" class="${(tab.dp || 'sem') === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}</div>${sub === 'semana' ? semanaView() : sub === 'equipes' ? equipesView() : sub === 'obras' ? obrasMargemView() : configView()}`;
}

EXT.click.push(async e => {
  let b;
  if ((b = e.target.closest('[data-ds]'))) { tab.ds = b.dataset.ds; render(); return true; }
  if ((b = e.target.closest('[data-dp]'))) { tab.dp = b.dataset.dp; render(); return true; }
  if ((b = e.target.closest('[data-dw]'))) { const v = +b.dataset.dw; tab.dw = v === 0 ? null : addDays(dSemana(), v); render(); return true; }
  if (e.target.closest('[data-dcopy]')) { const t = $('#dtxt').textContent; try { await navigator.clipboard.writeText(t); alert('Texto copiado.'); } catch (err) { const r = document.createRange(); r.selectNodeContents($('#dtxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); alert('Selecione e copie (Ctrl+C).'); } return true; }
  return false;
});
EXT.change.push(async e => {
  const t = e.target;
  if (t.dataset.dcfg) { const v = numI(t.value); if (v != null && v >= 0) { cfgD()[t.dataset.dcfg] = v; save(); render(); } return true; }
  if (t.dataset.dcargo) { const [id, k] = t.dataset.dcargo.split(':'), cg = S.cargos.find(x => x.id === id); cg[k] = numI(t.value); save(); render(); return true; }
  if (t.dataset.dpreco) { const o = getObra(t.dataset.dpreco); o.precoM2 = numI(t.value) || 0; save(); render(); return true; }
  return false;
});
