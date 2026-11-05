/* Resultado por contrato: receita, custos, lucro, R$/dia, custo de mão de obra por dia, rendimento por pessoa e produtividade da equipe. */
'use strict';
const mon = v => (v == null || !isFinite(v) ? '—' : brl(v));
const pc1r = (n, d = 1) => Number(n || 0).toFixed(d).replace('.', ',');
const ticksBar = (pct, cor = 'var(--blue)', n = 40) => { const on = Math.round(Math.max(0, Math.min(100, pct || 0)) / 100 * n); return `<div class="tk">${Array.from({ length: n }, (_, i) => `<i style="${i < on ? 'background:' + cor : ''}"></i>`).join('')}</div>`; };
function resPer() { const sv = tab.dp; tab.dp = tab.rp || 'tudo'; const p = dPeriodo(); tab.dp = sv; return p; }
const resIn = (d, per) => d >= per.ini && d <= per.fim;

function resCalc(c, per) {
  const rdos = S.rdos.filter(r => r.status === 'salvo' && r.obraId === c.obraId && resIn(r.data, per));
  const dias = {}, pess = {}; let rec = 0, m2 = 0, cmo = 0, cmatRdo = 0, hh = 0, semTaxa = new Set(), pessDia = 0;
  rdos.forEach(r => {
    const k = rdoCalc(r), nomes = r.maoObra || [], n = nomes.length || r.pessoas || 0;
    rec += k.receita; m2 += k.m2; cmatRdo += k.custo; hh += k.hh; pessDia += n;
    const d = (dias[r.data] = dias[r.data] || { rec: 0, mo: 0, m2: 0 }); d.rec += k.receita; d.m2 += k.m2;
    nomes.forEach(nm => {
      const f = findFunc(nm), cd = f ? custoDia(f) : null, key = f ? f.nome : nm;
      const p = (pess[key] = pess[key] || { nome: key, dias: new Set(), rec: 0, m2: 0, custo: 0, func: f, cd });
      if (!p.dias.has(r.data)) { p.dias.add(r.data); if (cd == null) semTaxa.add(key); else { p.custo += cd; cmo += cd; d.mo += cd; } }
      p.rec += n ? k.receita / n : 0; p.m2 += n ? k.m2 / n : 0;
    });
  });
  const cxo = cxPorObra(S.caixinha.filter(x => resIn(x.data, per)))[c.obraId] || 0;
  const ns = (S.notasEmitidas || []).filter(n => n.contratoId === c.id && resIn(n.data, per));
  const fat = ns.reduce((a, n) => a + n.bruto, 0), liq = ns.reduce((a, n) => a + n.liquido, 0);
  const diasN = Object.keys(dias).length, custoTot = cmo + cmatRdo + cxo;
  return { c, o: ctObra(c), rdos, dias, pess: Object.values(pess), rec, m2, cmo, cmatRdo, cxo, custoTot, fat, liq, nNotas: ns.length, diasN, hh, pessDia, semTaxa: [...semTaxa],
    lucro: rec - custoTot, lucroCaixa: liq - custoTot, margem: rec ? (rec - custoTot) / rec * 100 : null };
}

function resKpis(R) {
  const k = (t, v, sub, extra = '') => `<div class="card kpi" style="margin:0"><div class="mono">${t}</div><div class="v" style="font-size:26px">${v}</div>${extra}<small class="sub">${sub}</small></div>`;
  const dias = R.diasN || 0;
  return `<div class="grid g4" style="margin-bottom:14px">
    ${k('Receita estimada (RDOs)', R.rec ? brl(R.rec) : '—', R.rec ? `${mon(R.diasN ? R.rec / R.diasN : null)} por dia de obra` : 'falta preço por fase', ticksBar(R.c.mo ? R.rec / R.c.mo * 100 : 0))}
    ${k('Faturado (NFS-e)', R.fat ? brl(R.fat) : '—', R.fat ? `líquido ${brl(R.liq)} · ${R.nNotas} nota(s)` : 'nenhuma nota no período', ticksBar(R.c.mo ? R.fat / R.c.mo * 100 : 0, 'var(--grn)'))}
    ${k('Custo total', brl(R.custoTot), `MO ${brl(R.cmo)} · material/RDO ${brl(R.cmatRdo)} · Caixinha ${brl(R.cxo)}`, ticksBar(R.rec ? R.custoTot / R.rec * 100 : 0, 'var(--red)'))}
    ${k('Lucro estimado', `<span class="${R.lucro >= 0 ? 'grn' : 'red'}">${brl(R.lucro)}</span>`, R.margem == null ? 'sem receita para calcular margem' : `margem ${pc1r(R.margem)}% · caixa (líquido − custo) ${brl(R.lucroCaixa)}`, ticksBar(Math.max(0, R.margem || 0), 'var(--grn)'))}
  </div>
  <div class="grid g4" style="margin-bottom:14px">
    ${k('Custo de mão de obra por dia', R.diasN ? brl(R.cmo / R.diasN) : '—', `${R.diasN} dia(s) com RDO · ${R.diasN ? pc1r(R.pessDia / R.diasN) : '0'} pessoas/dia`)}
    ${k('Lucro por dia de obra', R.diasN ? brl(R.lucro / R.diasN) : '—', 'receita − custos ÷ dias com RDO')}
    ${k('Produtividade', R.diasN ? `${nfmt(R.m2 / R.diasN)} m²/dia` : '—', R.pessDia ? `${pc1r(R.m2 / R.pessDia, 2)} m² por pessoa-dia${R.hh && R.m2 ? ` · RUP ${pc1r(R.hh / R.m2, 2)} HH/m²` : ''}` : 'sem presença nos RDOs')}
    ${k('R$ de MO por m²', R.m2 ? brl(R.cmo / R.m2) : '—', R.rec && R.m2 ? `receita ${brl(R.rec / R.m2)}/m²` : 'sem m² lançados')}
  </div>`;
}

function resAvisos(Rs) {
  const av = [];
  const semPreco = Rs.filter(R => R.rdos.length && !R.rec); if (semPreco.length) av.push(`Sem preço por fase → receita estimada zerada em: ${semPreco.map(R => esc(short(R.c.nome))).join(', ')}.`);
  const st = new Set(); Rs.forEach(R => R.semTaxa.forEach(n => st.add(n))); if (st.size) av.push(`Sem custo/dia (não entram no custo de MO): ${[...st].map(esc).join(', ')}.`);
  const sv = Rs.filter(R => R.c.semValor); if (sv.length) av.push(`Contrato sem valor cadastrado: ${sv.map(R => esc(short(R.c.nome))).join(', ')}.`);
  av.push('Receita estimada = m² do RDO × preço da fase (peso do contrato). Rendimento por pessoa = parte igual da equipe do dia (média, não medição individual). Material de estoque (retiradas) não tem preço e não entra no custo.');
  return `<div class="alert" style="margin-bottom:14px;background:var(--ambS);border-color:var(--line)"><b class="amb">Como ler</b><ul style="margin:6px 0 0;padding-left:18px">${av.map(a => `<li>${a}</li>`).join('')}</ul></div>`;
}

function resSeries(Rs, per) {
  const set = new Set(); Rs.forEach(R => Object.keys(R.dias).forEach(d => set.add(d))); const days = [...set].sort();
  const cum = fn => { let a = 0; return days.map(d => (a += Rs.reduce((s, R) => s + fn(R.dias[d] || { rec: 0, mo: 0 }), 0))); };
  const rec = cum(x => x.rec), mo = cum(x => x.mo);
  return { days, series: [{ name: 'Receita estimada', color: '#1f8a4c', cum: rec }, { name: 'Custo de mão de obra', color: '#c0392b', cum: mo }, { name: 'Resultado (receita − MO)', color: '#0b3fbf', cum: rec.map((v, i) => v - mo[i]) }] };
}

function resPessoas(R) {
  const rows = R.pess.slice().sort((a, b) => b.rec - a.rec).map(p => { const dn = p.dias.size, res = p.cd == null ? null : p.rec - p.custo;
    return `<tr><td><b>${esc(p.nome)}</b><small style="display:block;color:var(--mut)">${esc((p.func && p.func.funcao) || '—')}</small></td><td class="n">${dn}</td><td class="n">${p.cd == null ? '<span class="pill a">informar</span>' : brl(p.cd)}</td><td class="n">${p.cd == null ? '—' : brl(p.custo)}</td><td class="n">${dn ? nfmt(p.m2 / dn) : '—'}</td><td class="n">${p.rec ? brl(p.rec / dn) : '—'}</td><td class="n">${p.rec ? brl(p.rec) : '—'}</td><td class="n ${res == null ? '' : res >= 0 ? 'grn' : 'red'}">${mon(res)}</td></tr>`; }).join('');
  return `<div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>Equipe e rendimento por pessoa</h2><span class="mono">${R.pess.length} pessoa(s)</span></div><table class="zebra"><tr><th>Pessoa</th><th class="n">Dias</th><th class="n">Custo/dia</th><th class="n">Custo</th><th class="n">m²/dia</th><th class="n">Rendimento/dia</th><th class="n">Rendimento total</th><th class="n">Resultado</th></tr>${rows || '<tr><td colspan="8">Sem presença registrada nos RDOs do período.</td></tr>'}</table>
  <p class="sub" style="margin:8px 0 0">Rendimento = receita estimada do dia dividida igualmente entre os presentes. Resultado = rendimento − custo/dia.</p></div>`;
}

function resumoContratoCard(R) {
  const c = R.c; return `<tr class="clk" data-rs="${c.obraId}"><td><i class="sw" style="border-color:${obraCor(c.obraId)}"></i><b>${esc(short(c.nome))}</b></td><td class="n">${c.semValor ? '<span class="pill a">informar</span>' : brl(c.mo)}</td><td class="n">${mon(R.rec || null)}</td><td class="n">${mon(R.fat || null)}</td><td class="n">${brl(R.cmo)}</td><td class="n">${brl(R.cmatRdo + R.cxo)}</td><td class="n ${R.lucro >= 0 ? 'grn' : 'red'}">${brl(R.lucro)}</td><td class="n">${R.margem == null ? '—' : pc1r(R.margem) + '%'}</td><td class="n">${R.diasN ? brl(R.cmo / R.diasN) : '—'}</td><td class="n">${R.diasN ? nfmt(R.m2 / R.diasN) : '—'}</td></tr>`;
}

function resultadoView() {
  const per = resPer(), cs = S.contratos || [], sel = obraF !== 'all' ? cs.find(c => c.obraId === obraF) : null;
  const all = cs.map(c => resCalc(c, per)), Rs = sel ? all.filter(R => R.c.id === sel.id) : all;
  const tabs = `<div class="tabs">${[['tudo', 'Tudo'], ['mes', 'Mês atual'], ['quin', 'Quinzena'], ['sem', 'Semana']].map(([k, l]) => `<button data-rp="${k}" class="${(tab.rp || 'tudo') === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const sub = sel ? 'Contrato · ' + short(sel.nome) : 'Todos os contratos';
  const T = Rs.reduce((a, R) => { ['rec', 'fat', 'liq', 'cmo', 'cmatRdo', 'cxo', 'custoTot', 'm2', 'pessDia', 'hh'].forEach(k => (a[k] = (a[k] || 0) + R[k])); a.diasN = Math.max(a.diasN || 0, R.diasN); return a; }, {});
  const tot = { c: sel || { mo: cs.reduce((a, c) => a + c.mo, 0), id: 'all' }, ...T, nNotas: Rs.reduce((a, R) => a + R.nNotas, 0), lucro: (T.rec || 0) - (T.custoTot || 0), lucroCaixa: (T.liq || 0) - (T.custoTot || 0), semTaxa: [] };
  tot.margem = tot.rec ? tot.lucro / tot.rec * 100 : null; tot.diasN = Rs.length === 1 ? Rs[0].diasN : new Set(Rs.flatMap(R => Object.keys(R.dias))).size; tot.pess = []; tot.rdos = Rs.flatMap(R => R.rdos);
  const ser = resSeries(Rs, per);
  const mx = Math.max(1, ...Rs.flatMap(R => [R.rec, R.custoTot, Math.abs(R.lucro)]));
  const bar = (v, cor) => `<div class="row" style="gap:8px;flex-wrap:nowrap"><div style="flex:1;background:var(--soft);border-radius:4px;height:8px"><div style="width:${Math.max(v > 0 ? 1 : 0, Math.abs(v) / mx * 100)}%;background:${cor};height:8px;border-radius:4px"></div></div><small style="min-width:92px;text-align:right">${brl(v)}</small></div>`;
  const barras = Rs.map(R => `<div style="margin-bottom:10px"><b style="font-size:12.5px">${esc(short(R.c.nome))}</b>${bar(R.rec, '#1f8a4c')}${bar(R.custoTot, '#c0392b')}${bar(R.lucro, R.lucro >= 0 ? '#0b3fbf' : '#c0392b')}</div>`).join('');
  const tbl = `<div class="card tw" style="margin-bottom:14px"><div class="row sp"><h2>Resultado por contrato</h2><span class="mono">${esc(per.rot)}</span></div><table class="zebra"><tr><th>Contrato</th><th class="n">MO contratada</th><th class="n">Receita est.</th><th class="n">Faturado</th><th class="n">Custo MO</th><th class="n">Material + Caixinha</th><th class="n">Lucro est.</th><th class="n">Margem</th><th class="n">MO/dia</th><th class="n">m²/dia</th></tr>${all.map(resumoContratoCard).join('')}</table></div>`;
  const grafs = `<div class="grid g2" style="margin-bottom:14px;grid-template-columns:1.6fr 1fr">${cardG('Acumulado no tempo', 'receita × custo de MO × resultado', ser.days.length ? svgLines(ser.days, ser.series, { label: 'resultado acumulado' }) + `<div class="legend">${ser.series.map(s => `<span><i class="sw" style="border-color:${s.color};background:${s.color}"></i>${s.name}</span>`).join('')}</div>` : '<p class="sub">Sem RDOs no período.</p>')}${cardG('Receita × custo × lucro', 'por contrato', barras + '<div class="legend"><span class="grn">▌ receita</span><span class="red">▌ custo</span><span class="blue">▌ lucro</span></div>')}</div>`;
  const pess = sel ? resPessoas(Rs[0]) : `<div class="card"><p class="sub" style="margin:0">Selecione uma obra/contrato no menu lateral (ou clique numa linha) para ver o rendimento por pessoa e a produtividade da equipe.</p></div>`;
  return `${head('Resultado', sub, `<button class="btn" data-rs="all">Todos os contratos</button>`)}${tabs}${resKpis(tot)}${resAvisos(Rs)}${sel ? '' : tbl}${grafs}${sel ? '' : ''}${pess}`;
}
VIEWS.res = resultadoView;
EXT.click.push(async e => {
  const t = e.target.closest('[data-rs],[data-rp],[data-ctgo]'); if (!t) return false;
  if (t.dataset.ctgo) { tab.ct = t.dataset.ctgo; view = 'contratos'; render(); return true; }
  if (t.dataset.rp) { tab.rp = t.dataset.rp; render(); return true; }
  obraF = t.dataset.rs; view = 'res'; render(); return true;
});

/* resumo do contrato selecionado, no topo das demais abas */
function ctStrip() {
  if (obraF === 'all' || view === 'res' || view === 'contratos') return '';
  const c = (S.contratos || []).find(x => x.obraId === obraF); if (!c) return '';
  const R = resCalc(c, { ini: '2000-01-01', fim: '2100-01-01' }), pct = c.mo ? R.fat / c.mo * 100 : 0;
  return `<div class="card strip" style="margin-bottom:14px"><div class="row sp"><div><span class="mono">Contrato</span> <b>${esc(c.nome)}</b> ${c.semValor ? '<span class="pill a">valor a informar</span>' : `<span class="pill b">MO ${brl(c.mo)}</span>`}</div><div class="row"><button class="btn sm" data-ctgo="${c.id}">Ver contrato</button><button class="btn sm" data-rs="${c.obraId}">Ver resultado</button></div></div>
  <div class="row" style="gap:22px;margin-top:8px"><span><span class="mono">Faturado</span><br><b>${mon(R.fat || null)}</b></span><span><span class="mono">Receita est.</span><br><b>${mon(R.rec || null)}</b></span><span><span class="mono">Custo</span><br><b>${brl(R.custoTot)}</b></span><span><span class="mono">Lucro est.</span><br><b class="${R.lucro >= 0 ? 'grn' : 'red'}">${brl(R.lucro)}</b></span><span><span class="mono">m² / dias RDO</span><br><b>${nfmt(R.m2)} / ${R.diasN}</b></span>${c.mo ? `<div style="flex:1;min-width:160px"><span class="mono">Faturado × MO ${pc1r(pct)}%</span>${ticksBar(pct, 'var(--grn)', 30)}</div>` : ''}</div></div>`;
}
