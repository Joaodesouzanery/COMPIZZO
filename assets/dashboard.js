/* Dashboard: visão por obra/contrato — faturamento, volume diário, custos, andamento e atividade recente. */
'use strict';
function dbUnidades(per) {
  const cs = (S.contratos || []).filter(c => c.ativo !== false);
  const Rc = cs.map(c => resCalc(c, per));
  const Av = S.obras.filter(o => !o.paiId && o.status !== 'Concluída' && !cs.some(c => obraFamilia(c.obraId).includes(o.id)))
    .map(o => resCalc({ id: 'x' + o.id, nome: o.nome, obraId: o.id, ids: obraFamilia(o.id), mo: 0, semValor: true }, per)).filter(R => R.rdos.length || R.fat || R.cxo || R.cmo);
  const all = Rc.concat(Av);
  return obraF === 'all' ? all : all.filter(R => R.ids.includes(obraF));
}
function dbDias(per) {
  const hoje = today(); let ini = per.ini, fim = per.fim < hoje ? per.fim : hoje;
  if (ini < '2026-06-01') { const ds = S.rdos.filter(r => r.status === 'salvo').map(r => r.data).sort(); ini = ds[0] || hoje; if (addDays(fim, -119) > ini) ini = addDays(fim, -119); }
  const out = []; for (let d = ini; d <= fim && out.length < 120; d = addDays(d, 1)) out.push(d); return out;
}
function dbM2(units, dias) { const m = {}; units.forEach(R => R.rdos.forEach(r => { m[r.data] = (m[r.data] || 0) + rdoCalc(r).m2; })); return dias.map(d => m[d] || 0); }
function dbChart(dias, cur, prev, cum) {
  const W = 900, H = 250, pl = 48, pr = 8, pt = 12, pb = 30, n = dias.length || 1;
  const acc = a => { let s = 0; return a.map(v => (s += v)); }, c = cum ? acc(cur) : cur, p = cum ? acc(prev) : prev;
  const max = Math.max(1, ...c, ...p) * 1.1, step = (W - pl - pr) / n, bw = Math.max(3, step * .55), y = v => pt + (H - pt - pb) * (1 - v / max);
  let g = [0, .25, .5, .75, 1].map(f => { const t = max / 1.1 * f; return `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl - 6}" y="${y(t) + 4}" font-size="10" text-anchor="end">${kfmt(t)}</text>`; }).join('');
  dias.forEach((d, i) => { const x = pl + i * step + (step - bw) / 2;
    if (p[i]) g += `<rect x="${x - 2}" y="${y(p[i])}" width="${bw}" height="${H - pb - y(p[i])}" rx="2" fill="var(--line)"/>`;
    if (c[i]) g += `<rect x="${x + 2}" y="${y(c[i])}" width="${bw}" height="${H - pb - y(c[i])}" rx="2" fill="var(--blue)"><title>${fdate(d)} · ${nfmt(c[i])} m²</title></rect>`; });
  const every = Math.ceil(n / 12); dias.forEach((d, i) => { if (i % every === 0) g += `<text x="${pl + i * step + step / 2}" y="${H - 10}" font-size="10" text-anchor="middle">${fdate(d).slice(0, 5)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Volume diário em m²">${g}</svg>`;
}
function dbCard(R) {
  const c = R.c, hoje = today(), ids = R.ids, ct = c.semValor ? null : c;
  const ds = S.rdos.filter(r => r.status === 'salvo' && ids.includes(r.obraId)).map(r => r.data).sort(), ult = ds[ds.length - 1];
  const sem = ult ? Math.round((new Date(hoje) - new Date(ult)) / 864e5) : null;
  const plano = ids.flatMap(i => swPlano(i, hoje)), parado = plano.length && plano.every(e => e.parado);
  const pessoasHoje = new Set(plano.filter(e => !e.parado).flatMap(e => e.equipe || [])).size;
  const e = ct ? ctExecutado(ct) : null, pctF = ct && ct.mo ? R.fat / ct.mo * 100 : 0, pctM = ct && ct.m2 ? e.m2 / ct.m2 * 100 : 0;
  const alerta = parado ? '<span class="pill r">PARADO HOJE</span>' : sem != null && sem > 4 ? `<span class="pill a">sem RDO há ${sem} d</span>` : '<span class="pill g">em andamento</span>';
  return `<div class="oc" data-rs="${R.c.obraId}"><div class="hd"><div><i class="sw" style="border-color:${obraCor(c.obraId)};background:${obraCor(c.obraId)}"></i><b>${esc(short(c.nome))}</b><small style="display:block;color:var(--mut)">${ct ? 'Contrato · MO ' + brl(ct.mo) : 'Fora da carteira de 5 contratos'}${ids.length > 1 ? ' · inclui ' + ids.slice(1).map(i => esc(short(obraNome(i)))).join(' e ') : ''}</small></div>${alerta}</div>
  ${ct ? `<div style="margin-top:10px"><div class="row sp"><span class="mono">Faturado × MO</span><b>${pc1r(pctF)}%</b></div>${ticksBar(pctF, 'var(--grn)', 36)}<div class="row sp"><span class="mono">Metragem executada × contratada</span><b>${pc1r(pctM)}%</b></div>${ticksBar(pctM, 'var(--blue)', 36)}</div>` : `<div style="margin-top:10px"><div class="row sp"><span class="mono">Faturado (NFS-e)</span><b>${mon(R.fat || null)}</b></div></div>`}
  <div class="met"><div><span class="mono">Faturado</span><b>${mon(R.fat || null)}</b></div><div><span class="mono">Custo</span><b>${brl(R.custoTot)}</b></div><div><span class="mono">${ct ? 'Lucro est.' : 'Faturado − custo'}</span><b class="${(ct ? R.lucro : R.fat - R.custoTot) >= 0 ? 'grn' : 'red'}">${brl(ct ? R.lucro : R.fat - R.custoTot)}</b></div><div><span class="mono">m² (período)</span><b>${nfmt(R.m2)}</b></div><div><span class="mono">Pessoas hoje</span><b>${pessoasHoje}</b></div><div><span class="mono">Último RDO</span><b>${ult ? fdate(ult).slice(0, 5) : '—'}</b></div></div>
  <div class="hoje"><span class="mono">Programação de hoje</span><br>${plano.length ? plano.map(p => esc(p.texto.length > 110 ? p.texto.slice(0, 108) + '…' : p.texto) + ((p.equipe || []).length ? ` <small style="display:inline;color:var(--mut)">(${p.equipe.map(esc).join(', ')})</small>` : '')).join('<br>') : '<span style="color:var(--mut)">sem programação lançada</span>'}</div></div>`;
}
function dbFeed(ids) {
  const fam = r => obraF === 'all' || ids.includes(r.obraId), ev = [];
  S.rdos.filter(r => r.status === 'salvo' && fam(r)).forEach(r => ev.push({ d: r.data, k: 'R', c: 'var(--blue)', t: `RDO · ${esc(short(obraNome(r.obraId)))}`, s: `${nfmt(rdoCalc(r).m2)} m² · ${(r.maoObra || []).length || r.pessoas || 0} pessoa(s)` }));
  S.retiradas.filter(r => obraF === 'all' || ids.includes(r.obraId)).forEach(r => { const m = S.materiais.find(x => x.id === r.materialId); ev.push({ d: r.data, k: 'E', c: 'var(--amb)', t: `Retirada · ${esc(m ? m.nome : r.nomeOriginal || '—')}`, s: `${nfmt(r.qtd)} un → ${esc(r.obraId ? short(obraNome(r.obraId)) : r.destinoTxt || 'destino a informar')}` }); });
  S.caixinha.filter(r => obraF === 'all' || (r.obras || []).some(o => ids.includes(o.obraId))).forEach(r => ev.push({ d: r.data, k: 'C', c: 'var(--grn)', t: `Caixinha · ${esc(r.fornecedor)}`, s: `${esc(r.descricao || '')} · ${brl(cxVal(r))}` }));
  (S.notasEmitidas || []).filter(n => obraF === 'all' || ids.includes(n.obraId) || (S.contratos.find(c => c.id === n.contratoId) || {}).obraId === obraF).forEach(n => ev.push({ d: n.data, k: 'N', c: '#7c3aed', t: `NFS-e ${esc(n.numero)} emitida`, s: `${esc(n.tomador)} · ${brl(n.bruto)}` }));
  return ev.sort((a, b) => b.d.localeCompare(a.d)).slice(0, 9).map(e => `<div class="it"><div class="dot" style="background:${e.c}">${e.k}</div><div style="min-width:0;flex:1"><b>${e.t}</b><small style="display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.s}</small></div><small style="color:var(--mut)">${fdate(e.d).slice(0, 5)}</small></div>`).join('');
}
function dashboardView() {
  const per = resPer(), units = dbUnidades(per), ids = units.flatMap(R => R.ids), hoje = today();
  const sum = k => units.reduce((a, R) => a + (R[k] || 0), 0), fat = sum('fat'), liq = sum('liq'), rec = sum('rec'), cmo = sum('cmo'), cmat = sum('cmatRdo') + sum('cmatEst'), cx = sum('cxo'), custo = cmo + cmat + cx, lucro = rec - custo;
  const dias = dbDias(per), cur = dbM2(units, dias), n = dias.length, prevDias = dias.map(d => addDays(d, -n)), prevM2 = (tab.rp || 'tudo') === 'tudo' ? dias.map(() => 0) : dbM2(units.map(R => ({ rdos: S.rdos.filter(r => r.status === 'salvo' && R.ids.includes(r.obraId)) })), prevDias);
  const cum = tab.dbc === 'cum', m2 = cur.reduce((a, b) => a + b, 0), m2p = prevM2.reduce((a, b) => a + b, 0), delta = m2p ? (m2 - m2p) / m2p * 100 : null;
  const tabs = `<div class="tabs" style="margin:0">${[['tudo', 'Tudo'], ['mes', 'Mês'], ['quin', 'Quinzena'], ['sem', 'Semana']].map(([k, l]) => `<button data-rp="${k}" class="${(tab.rp || 'tudo') === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const k = (t, v, sub, bar) => `<div class="card kpi" style="margin:0;padding:16px"><div class="mono">${t}</div><div class="v" style="font-size:28px">${v}</div>${bar || ''}<small class="sub">${sub}</small></div>`;
  const mo = cs => cs.filter(c => c.ativo !== false).reduce((a, c) => a + c.mo, 0), moT = mo(S.contratos);
  const kpis = `<div class="grid g4" style="margin-bottom:14px">${k('Faturado (NFS-e)', mon(fat || null), `líquido ${brl(liq)} · ${pc1r(moT ? fat / moT * 100 : 0)}% da MO contratada`, ticksBar(moT ? fat / moT * 100 : 0, 'var(--grn)'))}${k('Receita estimada (RDOs)', mon(rec || null), 'm² lançado × preço da fase', ticksBar(moT ? rec / moT * 100 : 0))}${k('Custo total', brl(custo), `MO ${brl(cmo)} · material ${brl(cmat)} · Caixinha ${brl(cx)}`, ticksBar(rec ? custo / rec * 100 : 0, 'var(--red)'))}${k('Lucro estimado', `<span class="${lucro >= 0 ? 'grn' : 'red'}">${brl(lucro)}</span>`, rec ? `margem ${pc1r(lucro / rec * 100)}%` : 'sem receita estimada no período', ticksBar(rec ? Math.max(0, lucro / rec * 100) : 0, 'var(--grn)'))}</div>`;
  const chart = `<div class="card" style="margin:0"><div class="row sp"><div><h2>Volume diário (m²)</h2><div class="legend" style="margin-top:4px"><span><i class="sw" style="border-color:var(--blue);background:var(--blue)"></i>${esc(per.rot)} · ${nfmt(m2)} m²${delta != null ? ` (${delta >= 0 ? '+' : ''}${pc1r(delta)}% vs anterior)` : ''}</span>${(tab.rp || 'tudo') === 'tudo' ? '' : `<span><i class="sw" style="border-color:var(--line);background:var(--line)"></i>período anterior · ${nfmt(m2p)} m²</span>`}</div></div><div class="tabs" style="margin:0"><button data-dbc="day" class="${cum ? '' : 'on'}">Diário</button><button data-dbc="cum" class="${cum ? 'on' : ''}">Acumulado</button></div></div><div style="margin-top:8px">${dias.length ? dbChart(dias, cur, prevM2, cum) : '<p class="sub">Sem dados.</p>'}</div></div>`;
  const notas = (S.notasEmitidas || []).slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
  const fatCard = `<div class="card" style="margin:0"><div class="row sp"><h2>Faturamento (NFS-e)</h2><button class="btn sm" data-nav="contratos">Ver todas</button></div><div class="feed" style="margin-top:6px">${notas.map(n => `<div class="it"><div class="dot" style="background:#7c3aed">${esc((n.tomador || '?').slice(0, 2).toUpperCase())}</div><div style="min-width:0;flex:1"><b>${brl(n.bruto)}</b><small style="display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.tomador)}</small></div><div style="text-align:right"><span class="pill ${n.substitui ? 'b' : 'g'}">${n.substitui ? 'substitui ' + esc(n.substitui) : 'emitida'}</span><small style="display:block;color:var(--mut)">${fdate(n.data).slice(0, 5)} · líq. ${brl(n.liquido)}</small></div></div>`).join('')}</div></div>`;
  const cards = `<div class="row sp" style="margin:6px 0 10px"><h2>Obras e contratos</h2><span class="mono">clique para ver o resultado da obra</span></div><div class="ocards">${units.map(dbCard).join('') || '<div class="card">Nenhuma obra no filtro.</div>'}</div>`;
  const tot = Math.max(1, custo), seg = [['Mão de obra', cmo, 'var(--blue)'], ['Material', cmat, 'var(--amb)'], ['Caixinha', cx, 'var(--grn)']];
  let sq = []; seg.forEach(([, v, c]) => { const q = Math.round(v / tot * 100); for (let i = 0; i < q; i++) sq.push(c); }); while (sq.length < 100) sq.push('var(--line)'); sq = sq.slice(0, 100);
  const waf = `<div class="card" style="margin:0"><h2>Mix de custos</h2><small class="sub">cada quadrado = 1% de ${brl(custo)}</small><div class="waf" style="grid-template-columns:repeat(20,1fr)">${sq.map(c => `<i style="background:${c}"></i>`).join('')}</div><table style="font-size:13.5px">${seg.map(([l, v, c]) => `<tr><td><i class="sw" style="border-color:${c};background:${c}"></i>${l}</td><td class="n">${brl(v)}</td><td class="n">${pc1r(v / tot * 100, 0)}%</td></tr>`).join('')}</table></div>`;
  const feed = `<div class="card" style="margin:0"><h2>Atividade recente</h2><div class="feed" style="margin-top:6px">${dbFeed(ids) || '<p class="sub">Sem atividade.</p>'}</div></div>`;
  const alertas = S.materiais.filter(m => stat(m) !== 'ok').slice(0, 5), bol = S.boletos.flatMap(b => b.parcelas.filter(p => !p.pago).map(p => ({ b, p }))).sort((a, b) => a.p.venc.localeCompare(b.p.venc)).slice(0, 4);
  const avis = `<div class="card" style="margin:0"><div class="row sp"><h2>Alertas</h2><button class="btn sm" data-nav="estoque">Estoque</button></div><div class="list" style="margin-top:4px">${alertas.map(m => `<div class="it"><div class="t"><b>${esc(m.nome)}</b><small>${nfmt(m.qtd)} ${esc(m.unidade)} · crítico ≤ ${m.critica}</small></div>${statPill(m)}</div>`).join('')}${bol.map(({ b, p }) => { const dd = Math.round((new Date(p.venc) - new Date(hoje)) / 864e5); return `<div class="it"><div class="t"><b>${esc(b.fornecedor)} · NF ${esc(b.nf)}</b><small>venc. ${fdate(p.venc)} · ${brl(p.valor)}</small></div><span class="pill ${dd < 0 ? 'r' : dd <= 7 ? 'a' : ''}">${dd < 0 ? 'vencido' : 'em ' + dd + ' d'}</span></div>`; }).join('')}</div></div>`;
  return `${head('Dashboard', new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), `${tabs}<button class="btn pri" data-act="retirada">Nova retirada</button>`)}
  ${typeof pendCard === 'function' ? pendCard() : ''}${kpis}<div class="dgrid dg-main" style="margin-bottom:14px">${chart}${fatCard}</div>${cards}<div class="dgrid dg-bot">${waf}${feed}${avis}</div>`;
}
VIEWS.today = dashboardView;
EXT.click.push(async e => { const t = e.target.closest('[data-dbc]'); if (!t) return false; tab.dbc = t.dataset.dbc; render(); return true; });
