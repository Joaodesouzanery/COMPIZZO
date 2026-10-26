/* Produção e RDO → aba "Geral" (dashboards) e visualização melhorada dos RDOs (lista + ficha). */
'use strict';
const PAL = ['#0b3fbf', '#c58a00', '#1f8a4c', '#c0392b', '#7c3aed', '#0891b2', '#be185d', '#475569', '#0f766e', '#92400e', '#4d7c0f', '#9333ea', '#334155'];
const obraCor = id => PAL[Math.max(0, S.obras.findIndex(o => o.id === id)) % PAL.length] || '#6f6f7a';
const nfmt = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const kfmt = n => (Math.abs(n) >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : nfmt(n));

/* ---------- gráficos SVG simples ---------- */
function svgStack(days, series, o = {}) {
  const W = 900, H = o.h || 240, pl = 44, pr = 8, pt = 10, pb = 34, n = days.length || 1;
  const tot = days.map(d => series.reduce((a, s) => a + (s.by[d] || 0), 0)), max = Math.max(1, ...tot) * 1.08;
  const bw = Math.max(3, (W - pl - pr) / n - 2), step = (W - pl - pr) / n, y = v => pt + (H - pt - pb) * (1 - v / max);
  const ticks = [0, .25, .5, .75, 1].map(f => max * f / 1.08);
  let g = ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="#e7e7ec"/><text x="${pl - 6}" y="${y(t) + 4}" font-size="10" text-anchor="end" fill="#6f6f7a">${kfmt(t)}</text>`).join('');
  days.forEach((d, i) => { let acc = 0; series.forEach(s => { const v = s.by[d] || 0; if (!v) return; const y0 = y(acc + v), h = y(acc) - y0; g += `<rect x="${pl + i * step + 1}" y="${y0}" width="${bw}" height="${Math.max(1, h)}" fill="${s.color}" rx="1.5"><title>${fdate(d)} · ${esc(s.name)}: ${nfmt(v)} ${o.un || ''}</title></rect>`; acc += v; }); });
  const every = Math.ceil(n / 14);
  days.forEach((d, i) => { if (i % every === 0) g += `<text x="${pl + i * step + bw / 2}" y="${H - 14}" font-size="10" text-anchor="middle" fill="#6f6f7a">${fdate(d).slice(0, 5)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label || 'gráfico')}">${g}</svg>`;
}
function svgLines(days, series, o = {}) {
  const W = 900, H = o.h || 240, pl = 44, pr = 12, pt = 10, pb = 34, n = Math.max(1, days.length - 1);
  const max = Math.max(1, ...series.map(s => s.cum[s.cum.length - 1] || 0)) * 1.08, x = i => pl + (W - pl - pr) * i / n, y = v => pt + (H - pt - pb) * (1 - v / max);
  let g = [0, .25, .5, .75, 1].map(f => { const t = max * f / 1.08; return `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="#e7e7ec"/><text x="${pl - 6}" y="${y(t) + 4}" font-size="10" text-anchor="end" fill="#6f6f7a">${kfmt(t)}</text>`; }).join('');
  series.forEach(s => { const pts = s.cum.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '); g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"><title>${esc(s.name)}</title></polyline>`; const L = s.cum.length - 1; g += `<circle cx="${x(L)}" cy="${y(s.cum[L])}" r="3.5" fill="${s.color}"/><text x="${Math.min(W - 4, x(L) + 6)}" y="${y(s.cum[L]) - 6}" font-size="10" text-anchor="end" fill="${s.color}">${nfmt(s.cum[L])}</text>`; });
  const every = Math.ceil(days.length / 12);
  days.forEach((d, i) => { if (i % every === 0) g += `<text x="${x(i)}" y="${H - 14}" font-size="10" text-anchor="middle" fill="#6f6f7a">${fdate(d).slice(0, 5)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label || 'gráfico')}">${g}</svg>`;
}
function hbars(items, o = {}) {
  const max = Math.max(1, ...items.map(i => Math.max(...(i.vals || [i.v])))) , fmt = o.fmt || nfmt;
  return `<div class="hb">${items.map(i => `<div class="hbr"><span class="hbl" title="${esc(i.l)}">${esc(i.l)}</span><div class="hbt">${(i.vals || [i.v]).map((v, k) => `<div class="hbb" style="width:${Math.max(.6, v / max * 100)}%;background:${(i.colors || [i.c || '#0b3fbf'])[k] || i.c || '#0b3fbf'}"><title>${esc(i.l)}: ${fmt(v)}</title></div>`).join('')}</div><span class="hbv">${(i.vals || [i.v]).map(fmt).join(' · ')}</span></div>`).join('') || '<p class="sub">Sem dados.</p>'}</div>`;
}
const cardG = (t, sub, inner) => `<div class="card" style="margin:0"><div class="row sp"><h2>${t}</h2><span class="mono">${sub || ''}</span></div><div style="margin-top:8px">${inner}</div></div>`;

/* ---------- dados do painel ---------- */
function gFiltro() {
  const per = tab.gp || 'all';
  const ok = d => per === 'all' || d.startsWith(per);
  const rdos = S.rdos.filter(r => r.status === 'salvo' && r.obraId && (obraF === 'all' || r.obraId === obraF) && ok(r.data));
  return { per, ok, rdos };
}
function gCobertura(f) {
  const out = {}, hoje = today();
  S.obras.forEach(o => { if (obraF !== 'all' && o.id !== obraF) return; const w = obraWindow(o); if (!w) return;
    let exp = 0, com = 0; const dias = new Set(S.rdos.filter(r => r.obraId === o.id && r.status === 'salvo').map(r => r.data));
    for (let d = w.ini; d <= w.fim && d <= hoje; d = addDays(d, 1)) { if (!f.ok(d) || !diaUtil(d)) continue; exp++; if (dias.has(d)) com++; }
    if (exp) out[o.id] = { exp, com, pct: com / exp * 100 }; });
  return out;
}
function geralView() {
  const f = gFiltro(), rdos = f.rdos;
  const meses = [...new Set(S.rdos.map(r => r.data.slice(0, 7)))].sort();
  const porObra = {}; S.obras.forEach(o => { porObra[o.id] = { o, rdos: [], m2: 0, pess: 0, fotos: 0, receita: 0, hh: 0, m2hh: 0, dias: new Set() }; });
  rdos.forEach(r => { const p = porObra[r.obraId]; if (!p) return; const c = rdoCalc(r); p.rdos.push(r); p.m2 += c.m2; p.pess += (r.pessoas ?? (r.maoObra || []).length); p.fotos += (r.fotosQtd || (r.fotos || []).length); p.receita += c.receita; if (c.hh && c.m2) { p.hh += c.hh; p.m2hh += c.m2; } p.dias.add(r.data); });
  const ativas = Object.values(porObra).filter(p => p.rdos.length);
  const totM2 = ativas.reduce((a, p) => a + p.m2, 0), totRdo = rdos.length, totPess = ativas.reduce((a, p) => a + p.pess, 0), totFotos = ativas.reduce((a, p) => a + p.fotos, 0);
  const cov = gCobertura(f), covV = Object.values(cov), covPct = covV.length ? covV.reduce((a, c) => a + c.com, 0) / Math.max(1, covV.reduce((a, c) => a + c.exp, 0)) * 100 : null;
  const diasM2 = {}; rdos.forEach(r => { const m = rdoCalc(r).m2; if (m) diasM2[r.data] = (diasM2[r.data] || 0) + m; });
  const melhor = Object.entries(diasM2).sort((a, b) => b[1] - a[1])[0], nDias = Object.keys(diasM2).length;
  const days = [...new Set(rdos.filter(r => rdoCalc(r).m2).map(r => r.data))].sort();
  const series = ativas.filter(p => p.m2).map(p => { const by = {}; p.rdos.forEach(r => { const m = rdoCalc(r).m2; if (m) by[r.data] = (by[r.data] || 0) + m; }); return { id: p.o.id, name: short(p.o.nome), color: obraCor(p.o.id), by }; });
  const lines = series.map(s => { let a = 0; return { name: s.name, color: s.color, cum: days.map(d => (a += s.by[d] || 0)) }; });
  const legenda = series.map(s => `<span><i class="sw" style="border-color:${s.color};background:${s.color}22"></i>${esc(s.name)}</span>`).join('');
  // financeiro
  const mm = S.metaMensal, metaPor = {}; (mm ? mm.obras : []).forEach(x => (metaPor[x.obraId] = x));
  const caixa = (S.caixinha || []).filter(r => f.ok(r.data)), cxO = typeof cxPorObra === 'function' ? cxPorObra(caixa) : {};
  const cxTot = caixa.reduce((a, r) => a + cxVal(r), 0);
  const parc = []; S.boletos.forEach(b => b.parcelas.forEach(p => parc.push({ ...p, forn: b.fornecedor })));
  const abertas = parc.filter(p => !p.pago), venc = abertas.filter(p => p.venc < today());
  const porMes = {}; parc.forEach(p => { const m = p.venc.slice(0, 7); (porMes[m] = porMes[m] || { aberto: 0, pago: 0 })[p.pago ? 'pago' : 'aberto'] += p.valor; });
  const mesesB = Object.keys(porMes).sort();
  const compras = S.compras.reduce((a, c) => a + c.total, 0);
  const rows = S.obras.filter(o => porObra[o.id].rdos.length || metaPor[o.id] || cxO[o.id]).map(o => { const p = porObra[o.id], m = metaPor[o.id], last = S.rdos.filter(r => r.obraId === o.id && r.status === 'salvo').map(r => r.data).sort().pop(), c = cov[o.id];
    const sem = last ? Math.max(0, Math.round((new Date(today()) - new Date(last)) / 864e5)) : null;
    return `<tr><td><i class="sw" style="border-color:${obraCor(o.id)};background:${obraCor(o.id)}22"></i><b>${esc(short(o.nome))}</b><small style="display:block;color:var(--mut)">${esc(o.status)}</small></td><td class="n">${o.bac ? brl(o.bac) : '—'}</td><td class="n">${m ? brl(m.bruto) : '—'}</td><td class="n">${m ? brl(m.liquido) : '—'}</td><td class="n">${nfmt(p.m2)}</td><td class="n">${p.m2hh ? (p.hh / p.m2hh).toFixed(2).replace('.', ',') : '—'}</td><td class="n">${p.receita ? brl(p.receita) : '<span style="color:var(--mut)">sem preço</span>'}</td><td class="n">${cxO[o.id] ? brl(cxO[o.id]) : '—'}</td><td class="n">${p.rdos.length}</td><td class="n">${c ? `<span class="${c.pct >= 80 ? 'ok' : c.pct >= 50 ? 'amb' : 'bad'}">${c.pct.toFixed(0)}%</span>` : '—'}</td><td>${last ? fdate(last) + (sem > 3 ? ` <span class="pill ${sem > 7 ? 'r' : 'a'}">${sem} d</span>` : '') : '—'}</td></tr>`; }).join('');
  const totBruto = (mm ? mm.obras : []).reduce((a, x) => a + x.bruto, 0), totLiq = (mm ? mm.obras : []).reduce((a, x) => a + x.liquido, 0);
  const equipe = {}; rdos.forEach(r => (r.maoObra || []).forEach(n => (equipe[n] = (equipe[n] || 0) + 1)));
  const topEq = Object.entries(equipe).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const tipos = {}; caixa.forEach(r => (tipos[r.tipo] = (tipos[r.tipo] || 0) + cxVal(r)));
  const metasAv = S.metas.filter(m => obraF === 'all' || m.obraId === obraF).map(m => { const prev = Object.values(m.qtds || {}).reduce((a, v) => a + v, 0), real = Object.keys(m.qtds || {}).reduce((a, fid) => a + realizadoAcum(m.obraId, fid, m.inicio, m.fim), 0); return { l: `${short(obraNome(m.obraId))} ${fdate(m.inicio).slice(0, 5)}–${fdate(m.fim).slice(0, 5)}`, prev, real, c: obraCor(m.obraId) }; });
  const kpi = (l, v, s, cls = '') => `<div class="card kpi" style="margin:0"><div class="mono">${l}</div><div class="v ${cls}" style="font-size:28px">${v}</div><small class="sub">${s || ''}</small></div>`;
  return `<div class="row sp" style="margin-bottom:12px"><div class="tabs" style="margin:0"><button data-gp="all" class="${f.per === 'all' ? 'on' : ''}">Tudo</button>${meses.map(m => `<button data-gp="${m}" class="${f.per === m ? 'on' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}/${m.slice(2, 4)}</button>`).join('')}</div><small class="sub" style="margin:0">Filtro de obra: barra lateral · dados: RDOs salvos (ConstruData + mensagens + app)</small></div>
  <div class="grid g4" style="margin-bottom:14px">${kpi('RDOs salvos', nfmt(totRdo), `${new Set(rdos.map(r => r.data)).size} dias com RDO`)}${kpi('m² executados', nfmt(totM2), nDias ? `média ${nfmt(totM2 / nDias)} m²/dia · melhor dia ${melhor ? fdate(melhor[0]).slice(0, 5) + ' (' + nfmt(melhor[1]) + ')' : '—'}` : '—')}${kpi('Trabalhadores-dia', nfmt(totPess), totRdo ? `${(totPess / totRdo).toFixed(1).replace('.', ',')} por RDO` : '')}${kpi('Fotos nos RDOs', nfmt(totFotos), 'contagem do relatório')}
  ${kpi('Cobertura de RDO', covPct == null ? '—' : covPct.toFixed(0) + '%', 'dias úteis com RDO ÷ esperados', covPct == null ? '' : covPct >= 80 ? 'ok' : covPct >= 50 ? 'amb' : 'bad')}${kpi('Meta do mês (bruto)', mm ? brl(totBruto) : '—', mm ? `líquido ${brl(totLiq)} · ${esc(mm.periodo)}` : '')}${kpi('Caixinha', brl(cxTot), `${caixa.length} lançamentos${caixa.some(r => cxFlags(r).some(x => x[0] === 'r')) ? ' · com pendências' : ''}`)}${kpi('Boletos em aberto', brl(abertas.reduce((a, p) => a + p.valor, 0)), venc.length ? `<span class="bad">${venc.length} parcela(s) vencida(s)</span>` : 'nenhuma vencida', venc.length ? 'bad' : '')}</div>
  <div class="grid g2" style="margin-bottom:14px;grid-template-columns:1.6fr 1fr">${cardG('m² executados por dia', 'empilhado por obra', days.length ? svgStack(days, series, { un: 'm²', label: 'm² por dia' }) + `<div class="legend">${legenda}</div>` : '<p class="sub">Sem m² lançados no filtro.</p>')}${cardG('m² por obra', 'total no filtro', hbars(ativas.filter(p => p.m2).sort((a, b) => b.m2 - a.m2).map(p => ({ l: short(p.o.nome), v: p.m2, c: obraCor(p.o.id) })), { fmt: v => nfmt(v) + ' m²' }))}</div>
  <div class="grid g2" style="margin-bottom:14px;grid-template-columns:1.6fr 1fr">${cardG('m² acumulados por obra', 'avanço no tempo', days.length ? svgLines(days, lines, { label: 'acumulado' }) + `<div class="legend">${legenda}</div>` : '<p class="sub">Sem dados.</p>')}${cardG('Cobertura de RDO por obra', 'dias úteis com RDO', hbars(Object.entries(cov).map(([id, c]) => ({ l: short(obraNome(id)), v: c.pct, c: c.pct >= 80 ? '#1f8a4c' : c.pct >= 50 ? '#c58a00' : '#c0392b' })), { fmt: v => v.toFixed(0) + '%' }) + '<small class="sub">Esperado = seg–sáb, sem feriado, entre início e fim da obra.</small>')}</div>
  <div class="card tw"><div class="row sp"><h2>Painel por obra — físico e financeiro</h2><span class="mono">receita estimada = quantidade × preço da fase (cadastre em Metas de produção)</span></div><table><tr><th>Obra</th><th class="n">BAC</th><th class="n">Meta bruto</th><th class="n">Meta líquido</th><th class="n">m² exec.</th><th class="n">RUP (HH/m²)</th><th class="n">Receita est.</th><th class="n">Caixinha</th><th class="n">RDOs</th><th class="n">Cobertura</th><th>Último RDO</th></tr>${rows}
  <tr><td><b>Total</b></td><td class="n"></td><td class="n"><b>${mm ? brl(totBruto) : '—'}</b></td><td class="n"><b>${mm ? brl(totLiq) : '—'}</b></td><td class="n"><b>${nfmt(totM2)}</b></td><td></td><td></td><td class="n"><b>${brl(cxTot)}</b></td><td class="n"><b>${totRdo}</b></td><td></td><td></td></tr></table></div>
  <div class="grid g2" style="margin:14px 0;grid-template-columns:1fr 1fr">${cardG('Meta × realizado (Metas de produção)', 'quantidade prevista × executada', metasAv.length ? hbars(metasAv.map(m => ({ l: m.l, vals: [m.prev, m.real], colors: ['#c4c4cc', m.c] })), { fmt: v => nfmt(v) }) + '<div class="legend"><span><i class="sw" style="border-color:#c4c4cc;background:#c4c4cc"></i>previsto</span><span><i class="sw" style="border-color:#0b3fbf;background:#0b3fbf"></i>realizado (RDOs com fase)</span></div>' : '<p class="sub">Nenhuma meta de produção cadastrada. Em <b>Metas de produção</b> informe a quantidade por fase e período para ver o avanço aqui.</p>')}${cardG('Boletos por mês de vencimento', 'em aberto × pago', mesesB.length ? hbars(mesesB.map(m => ({ l: MESES[+m.slice(5) - 1] + '/' + m.slice(2, 4), vals: [porMes[m].aberto, porMes[m].pago], colors: ['#c0392b', '#1f8a4c'] })), { fmt: brl }) + '<div class="legend"><span class="bad">■ em aberto</span><span class="ok">■ pago</span></div>' : '<p class="sub">Sem boletos.</p>')}</div>
  <div class="grid g3" style="margin-bottom:14px">${cardG('Caixinha por tipo', brl(cxTot), hbars(Object.entries(tipos).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v, c: '#0891b2' })), { fmt: brl }))}${cardG('Custo da caixinha por obra', 'com rateio', hbars(Object.entries(cxO).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ l: cxNomeObra(id), v, c: id ? obraCor(id) : '#6f6f7a' })), { fmt: brl }))}${cardG('Presença nos RDOs', 'dias por pessoa (top 12)', hbars(topEq.map(([l, v]) => ({ l, v, c: '#0b3fbf' })), { fmt: v => v + ' d' }))}</div>
  <div class="card"><h2>Resumo financeiro</h2><div class="tw"><table><tr><th>Item</th><th class="n">Valor</th><th>Observação</th></tr>
  <tr><td>Meta de faturamento do mês (bruto)</td><td class="n">${mm ? brl(totBruto) : '—'}</td><td>${mm ? esc(mm.periodo) : ''}</td></tr><tr><td>Meta líquida (−30% impostos −5% retenção −R$ 20 mil de entrada na Supera)</td><td class="n">${mm ? brl(totLiq) : '—'}</td><td></td></tr>
  <tr><td>Compras de orçamento (materiais)</td><td class="n">${brl(S.compras.filter(c => !c.avulsa).reduce((a, c) => a + c.total, 0))}</td><td>${S.compras.filter(c => !c.avulsa).length} fornecedores</td></tr><tr><td>Compras faturadas</td><td class="n">${brl(S.compras.filter(c => c.avulsa).reduce((a, c) => a + c.total, 0))}</td><td>boletos a pagar</td></tr>
  <tr><td>Caixinha / linha direta (filtro)</td><td class="n">${brl(cxTot)}</td><td>${caixa.length} lançamentos</td></tr><tr><td>Boletos em aberto</td><td class="n">${brl(abertas.reduce((a, p) => a + p.valor, 0))}</td><td>${abertas.length} parcela(s)${venc.length ? ` · ${venc.length} vencida(s)` : ''}</td></tr>
  <tr><td>Receita estimada pelos RDOs</td><td class="n">${brl(ativas.reduce((a, p) => a + p.receita, 0))}</td><td>${ativas.some(p => p.receita) ? '' : 'preços por fase não cadastrados'}</td></tr></table></div></div>`;
}

/* ---------- RDOs: lista melhorada e ficha ---------- */
function rdoConferencia() {
  const imp = (S.importacoes || [])[0]; if (!imp) return '';
  const rs = S.rdos.filter(r => r.importado), m2 = rs.reduce((a, r) => a + rdoCalc(r).m2, 0), pe = rs.reduce((a, r) => a + (r.pessoas || 0), 0), fo = rs.reduce((a, r) => a + (r.fotosQtd || 0), 0);
  const ok = (a, b) => (a === b ? '<span class="ok">✔</span>' : `<span class="bad">✗ ${nfmt(a)} ≠ ${nfmt(b)}</span>`);
  return `<div class="card" style="margin-bottom:14px"><div class="row sp"><h2>Conferência da importação — ${esc(imp.fonte)}</h2><span class="mono">${esc(imp.periodo)} · gerado ${esc(imp.gerado)}</span></div><div class="grid g4" style="margin-top:8px"><div><div class="mono">RDOs</div><b>${rs.length} de ${imp.rdos}</b> ${ok(rs.length, imp.rdos)}</div><div><div class="mono">m² executados</div><b>${nfmt(m2)}</b> ${ok(m2, imp.m2)}</div><div><div class="mono">Trabalhadores-dia</div><b>${pe}</b> ${ok(pe, imp.pessoas)}</div><div><div class="mono">Fotos (contagem)</div><b>${fo}</b> ${ok(fo, imp.fotos)}</div></div><p class="sub" style="margin:8px 0 0">Importados: data, obra, responsável, clima, equipe, serviços, produção, HH/RUP, materiais-modelo, equipamentos, ocorrências, observações e planejamento. Não importados: os arquivos das ${imp.fotos} fotos (só a contagem) e linhas vazias do relatório ("Nenhum serviço/trecho").</p></div>`;
}
function rdoListV2() {
  const q = norm(tab.rq || ''), st = tab.rst || 'all', mes = tab.rm || 'all';
  const meses = [...new Set(S.rdos.map(r => r.data.slice(0, 7)))].sort();
  const list = S.rdos.filter(r => (obraF === 'all' || r.obraId === obraF) && (mes === 'all' || r.data.startsWith(mes)) && (st === 'all' || r.status === st || (st === 'importado' && r.importado)) && (!q || norm([r.titulo, r.responsavel, (r.maoObra || []).join(' '), (r.servicos || []).join(' '), r.descricao, r.obs, obraNome(r.obraId)].join(' ')).includes(q))).sort((a, b) => b.data.localeCompare(a.data) || (b.numero || 0) - (a.numero || 0));
  const tot = list.reduce((a, r) => a + rdoCalc(r).m2, 0);
  const rows = list.map(r => { const c = rdoCalc(r), o = getObra(r.obraId); return `<tr class="clk" data-rv="${r.id}"><td><b>${fdate(r.data)}</b><small style="display:block;color:var(--mut)">${DOW[dowIdx(r.data)]}${r.numero ? ' · nº ' + r.numero : ''}</small></td><td><i class="sw" style="border-color:${obraCor(r.obraId)};background:${obraCor(r.obraId)}22"></i>${esc(o ? short(o.nome) : '— sem obra —')}</td><td>${esc(r.responsavel || '—')}</td><td>${(r.maoObra || []).length ? `<span title="${esc(r.maoObra.join(', '))}">${r.maoObra.length} pess.</span>` : (r.pessoas ? r.pessoas + ' pess.' : '—')}</td><td>${esc((r.servicos || []).slice(0, 2).join(' · ') || r.descricao || '—').slice(0, 90)}</td><td class="n">${c.m2 ? nfmt(c.m2) : '—'}</td><td class="n">${r.fotosQtd || (r.fotos || []).length || '—'}</td><td>${r.clima ? esc(r.clima) : '—'}</td><td><span class="pill ${r.status === 'salvo' ? 'g' : 'a'}">${r.status === 'salvo' ? 'Salvo' : 'Rascunho'}</span>${r.origem === 'mensagem' ? ' <span class="pill b">mensagem</span>' : ''}</td></tr>`; }).join('');
  return `${rdoConferencia()}<div class="row sp" style="margin-bottom:12px"><div class="row"><input id="rq" placeholder="Buscar em obra, equipe, serviço…" value="${esc(tab.rq || '')}" style="min-width:260px"><div class="tabs" style="margin:0"><button data-rm="all" class="${mes === 'all' ? 'on' : ''}">Todos</button>${meses.map(m => `<button data-rm="${m}" class="${mes === m ? 'on' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}/${m.slice(2, 4)}</button>`).join('')}</div><div class="tabs" style="margin:0">${[['all', 'Todos'], ['salvo', 'Salvos'], ['rascunho', 'Rascunhos'], ['importado', 'ConstruData']].map(([k, l]) => `<button data-rst="${k}" class="${st === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><span class="mono">${list.length} RDOs · ${nfmt(tot)} m²</span></div>
  <div class="card tw"><table class="zebra"><tr><th>Data</th><th>Obra</th><th>Responsável</th><th>Equipe</th><th>Serviços</th><th class="n">m²</th><th class="n">Fotos</th><th>Clima</th><th>Status</th></tr>${rows || '<tr><td colspan="9">Nenhum RDO neste filtro.</td></tr>'}</table><p class="sub" style="margin-top:8px">Clique em uma linha para abrir a ficha completa do RDO.</p></div>`;
}
function rdoFicha(id) {
  const r = S.rdos.find(x => x.id === id); if (!r) return '';
  const c = rdoCalc(r), o = getObra(r.obraId), chip = (a, cl = '') => (a || []).map(x => `<span class="pill ${cl}">${esc(x)}</span>`).join(' ') || '<small class="sub" style="margin:0">—</small>';
  const sec = (t, inner) => `<div class="card"><h2>${t}</h2><div style="margin-top:8px">${inner}</div></div>`;
  const prod = (r.fases || []).map(l => { const f = S.fases.find(x => x.id === l.faseId); return `<tr><td>${esc(f ? f.nome : (l.nome || '—'))}</td><td class="n"><b>${nfmt(l.qtd)}</b> ${esc(l.un || (f && f.un) || '')}</td><td class="n">${l.previsto ? nfmt(l.previsto) : '—'}</td><td class="n">${l.previsto ? Math.round((+l.qtd || 0) / l.previsto * 100) + '%' : '—'}</td></tr>`; }).join('');
  const fotos = (r.fotos || []).filter(f => String(f.id).startsWith('url:'));
  return `${head(`RDO ${r.numero ? '#' + r.numero + ' · ' : ''}${fdate(r.data)}`, `${o ? o.nome : 'sem obra'} · ${DOW[dowIdx(r.data)]}`, `<button class="btn" data-rv="back">Voltar à lista</button><button class="btn" onclick="window.print()">Imprimir / PDF</button><button class="btn pri" data-rd="open:${r.id}">Editar</button>`)}
  <div class="grid g4" style="margin-bottom:14px"><div class="card kpi" style="margin:0"><div class="mono">Responsável</div><b>${esc(r.responsavel || '—')}</b></div><div class="card kpi" style="margin:0"><div class="mono">Clima · dia da obra</div><b>${esc(r.clima || '—')}</b> · ${esc(r.diaTxt || diaObra(o, r.data) || '—')}</div><div class="card kpi" style="margin:0"><div class="mono">m² executados</div><div class="v" style="font-size:26px">${nfmt(c.m2)}</div></div><div class="card kpi" style="margin:0"><div class="mono">HH · RUP</div><b>${r.hh ? nfmt(r.hh) + ' HH' : '—'}</b> ${c.rup != null ? '· ' + c.rup.toFixed(3).replace('.', ',') : r.rup ? '· ' + String(r.rup).replace('.', ',') : ''}</div></div>
  ${sec(`Equipe presente (${(r.maoObra || []).length || r.pessoas || 0})`, chip(r.maoObra, 'b') + ((r.maoObraOrig && r.maoObraOrig.length) ? `<p class="sub" style="margin:8px 0 0">No relatório: ${esc(r.maoObraOrig.join(' · '))}</p>` : ''))}
  ${sec('Serviços executados', chip(r.servicos) + (r.descricao ? `<p style="margin:10px 0 0">${esc(r.descricao)}</p>` : ''))}
  ${prod ? sec('Produção do dia', `<div class="tw"><table><tr><th>Serviço</th><th class="n">Executado</th><th class="n">Previsto</th><th class="n">%</th></tr>${prod}</table></div>`) : ''}
  ${(r.materiaisTpl || []).length || (r.materiais || []).length ? sec('Materiais', `<div class="tw"><table><tr><th>Material</th><th class="n">Qtd.</th><th>Origem</th></tr>${[...(r.materiais || []).map(m => `<tr><td>${esc((S.materiais.find(x => x.id === m.materialId) || {}).nome || m.nome)}</td><td class="n">${esc(m.qtd)}</td><td>${m.materialId ? 'estoque' : 'fora do estoque'}</td></tr>`), ...(r.materiaisTpl || []).map(m => `<tr><td>${esc(m.nome)}</td><td class="n">—</td><td>${esc(m.origem)}</td></tr>`)].join('')}</table></div>${(r.materiaisTpl || []).length ? '<small class="sub">Linhas-modelo do ConstruData, sem quantidade informada.</small>' : ''}`) : ''}
  ${sec('Equipamentos e ocorrências', `<div class="grid g2" style="grid-template-columns:1fr 1fr"><div><div class="mono">Equipamentos</div>${chip(r.equipamentos)}</div><div><div class="mono">Ocorrências</div>${chip(r.ocorrencias, 'r')}</div></div>`)}
  ${(r.obs || r.proximo) ? sec('Observações e planejamento', `${r.obs ? `<div class="mono">Observações</div><p>${esc(r.obs)}</p>` : ''}${r.proximo ? `<div class="mono">Planejamento para o próximo dia</div><p>${esc(r.proximo)}</p>` : ''}`) : ''}
  ${sec(`Registro fotográfico (${r.fotosQtd || (r.fotos || []).length})`, fotos.length ? `<div class="row">${fotos.map(f => `<a href="${esc(f.id.slice(4))}" target="_blank"><img src="${esc(f.id.slice(4))}" alt="" style="height:120px;border-radius:10px;border:1px solid var(--line)"></a>`).join('')}</div>` : `<small class="sub" style="margin:0">${r.fotosQtd ? r.fotosQtd + ' foto(s) no relatório do ConstruData (arquivos não importados).' : 'Sem fotos.'}</small>`)}
  <p class="sub">Origem: ${r.importado ? 'ConstruData (importado)' : r.origem === 'mensagem' ? 'mensagem do campo' : 'app'} · status: ${esc(r.status)}${r.obraInferida ? ' · obra inferida pela data/equipe — confirme' : ''}</p>`;
}

EXT.click.push(async e => {
  const g = e.target.closest('[data-gp]'); if (g) { tab.gp = g.dataset.gp; render(); return true; }
  const m = e.target.closest('[data-rm]'); if (m) { tab.rm = m.dataset.rm; render(); return true; }
  const s = e.target.closest('[data-rst]'); if (s) { tab.rst = s.dataset.rst; render(); return true; }
  const v = e.target.closest('[data-rv]'); if (v && !e.target.closest('button[data-rd]')) { tab.rv = v.dataset.rv === 'back' ? null : v.dataset.rv; render(); window.scrollTo(0, 0); return true; }
  return false;
});
EXT.input.push(e => { if (e.target.id === 'rq') { tab.rq = e.target.value; const p = e.target.selectionStart; render(); const n = $('#rq'); n.focus(); n.setSelectionRange(p, p); return true; } return false; });
