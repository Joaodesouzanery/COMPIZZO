/* Produção → "Semana planejada": programação semanal/diária × equipe × custo × RDO lançado. */
'use strict';
const swSemana = () => tab.sw || mondayOf(today());
// programação efetiva do dia (a agenda do dia substitui a semanal)
const swPlano = (obraId, d) => S.calendario.filter(e => !e.substituidoPor && e.obraId === obraId && e.data === d);

function semanaPlanView() {
  const w = swSemana(), dias = [0, 1, 2, 3, 4, 5].map(i => addDays(w, i)), hoje = today();
  const obras = S.obras.filter(o => dias.some(d => swPlano(o.id, d).length));
  const pessoaDia = [], conflitos = [], mudancas = [], pend = [], alertas = [];
  const porDia = {};
  obras.forEach(o => dias.forEach(d => swPlano(o.id, d).forEach(e => {
    if (e.parado) return;
    (e.equipe || []).forEach(nm => { const f = findFunc(nm); const key = f ? f.id : nm; (porDia[d] = porDia[d] || {}); (porDia[d][key] = porDia[d][key] || []).push(o.id); pessoaDia.push({ d, o: o.id, nm, f }); });
    if (S.feriados[d] && (e.equipe || []).length) alertas.push(`${fdate(d)} é feriado (${S.feriados[d]}), mas ${esc(short(o.nome))} tem equipe prevista: ${e.equipe.map(esc).join(', ')}.`);
    if (/definir/i.test(e.cond || e.texto) && (e.equipe || []).length) alertas.push(`${esc(short(o.nome))} ${fdate(d)}: ${e.equipe.map(esc).join(', ')} alocado(s) sem atividade definida (diária sem produção).`);
    if (/solicitar|verificar|libera|projeto impresso|analisar/i.test(e.texto)) pend.push({ o, d, t: e.texto });
  })));
  Object.entries(porDia).forEach(([d, m]) => Object.entries(m).forEach(([k, os]) => { if (new Set(os).size > 1) conflitos.push(`${fdate(d)}: ${esc((S.funcionarios.find(f => f.id === k) || { nome: k }).nome)} em ${[...new Set(os)].map(i => esc(short(obraNome(i)))).join(' e ')}.`); }));
  // semanal x agenda do dia: mudança de equipe
  S.calendario.filter(e => e.substituidoPor === 'Agenda do dia' && e.fonte === 'Programação semanal' && dias.includes(e.data)).forEach(e => {
    const dia = swPlano(e.obraId, e.data).find(x => x.fonte === 'Agenda do dia'); if (!dia) return;
    const a = [...(e.equipe || [])].sort().join(','), b = [...(dia.equipe || [])].sort().join(',');
    if (a !== b) mudancas.push(`${fdate(e.data)} ${esc(short(obraNome(e.obraId)))}: semanal ${e.equipe.map(esc).join(', ') || '—'} → dia ${dia.equipe.map(esc).join(', ') || '—'}.`);
  });
  const custoPrev = pessoaDia.reduce((a, p) => a + ((p.f && custoDiaInfo(p.f).v) || 0), 0), semCusto = [...new Set(pessoaDia.filter(p => !p.f || custoDiaInfo(p.f).v == null).map(p => p.nm))];
  const porObra = {}; pessoaDia.forEach(p => { const x = (porObra[p.o] = porObra[p.o] || { pd: 0, custo: 0 }); x.pd++; x.custo += (p.f && custoDiaInfo(p.f).v) || 0; });
  // aderência: dias passados com atividade prevista × RDO salvo
  let prev = 0, feito = 0; const faltaRdo = [];
  obras.forEach(o => dias.forEach(d => { if (d > hoje || S.feriados[d] || dowIdx(d) > 5) return; const ativos = swPlano(o.id, d).filter(e => !e.parado); if (!ativos.length) return; prev++; if (S.rdos.some(r => r.obraId === o.id && r.data === d && r.status === 'salvo')) feito++; else faltaRdo.push(`${fdate(d)} ${esc(short(o.nome))}`); }));
  const liberam = obras.filter(o => dias.some(d => swPlano(o.id, d).some(e => /finalizar hoje|objetivo/i.test(e.texto)))).map(o => { const e = dias.flatMap(d => swPlano(o.id, d)).find(x => /finalizar hoje|objetivo/i.test(x.texto)); return `${esc(short(o.nome))} termina em ${fdate(e.data)} → libera ${(e.equipe || []).map(esc).join(', ') || 'equipe'}.`; });
  const k = (t, v, sub) => `<div class="card kpi" style="margin:0"><div class="mono">${t}</div><div class="v" style="font-size:26px">${v}</div><small class="sub">${sub}</small></div>`;
  const grade = obras.map(o => `<tr><td><i class="sw" style="border-color:${obraCor(o.id)};background:${obraCor(o.id)}"></i><b>${esc(short(o.nome))}</b>${porObra[o.id] ? `<small style="display:block;color:var(--mut)">${porObra[o.id].pd} pessoa-dia · ${brl(porObra[o.id].custo)}</small>` : ''}</td>${dias.map(d => { const es = swPlano(o.id, d), rdo = S.rdos.some(r => r.obraId === o.id && r.data === d && r.status === 'salvo');
    return `<td class="swc ${S.feriados[d] ? 'fer' : ''}">${es.length ? es.map(e => e.parado ? `<span class="pill r">PARADO</span><small>${esc(e.texto.replace(/^PARADO\s*[—-]?\s*/i, ''))}</small>` : `<div>${esc(e.texto.length > 120 ? e.texto.slice(0, 118) + '…' : e.texto)}</div><div class="row" style="gap:4px;margin-top:4px">${(e.equipe || []).map(n => `<span class="pill b">${esc(n)}</span>`).join('') || '<span class="pill a">sem equipe</span>'}</div>`).join('') + (d <= hoje && !S.feriados[d] ? `<div style="margin-top:4px"><span class="pill ${rdo ? 'g' : 'r'}">${rdo ? '✔ RDO' : '✖ sem RDO'}</span></div>` : '') : '<span style="color:var(--mut)">—</span>'}</td>`; }).join('')}</tr>`).join('');
  const lista = (t, arr, vazio) => `<div class="card" style="margin:0"><h2>${t}</h2>${arr.length ? `<ul style="margin:8px 0 0;padding-left:18px;line-height:1.55">${arr.map(x => `<li>${x}</li>`).join('')}</ul>` : `<p class="sub" style="margin:8px 0 0">${vazio}</p>`}</div>`;
  return `<div class="row sp" style="margin-bottom:12px"><div class="row"><button class="btn sm" data-swk="-7">◀ semana anterior</button><b>${fdate(dias[0])} a ${fdate(dias[5])}</b><button class="btn sm" data-swk="7">próxima ▶</button><button class="btn sm" data-swk="0">esta semana</button></div><span class="mono">a agenda do dia substitui a programação semanal</span></div>
  <div class="grid g4" style="margin-bottom:14px">${k('Pessoa-dia planejados', pessoaDia.length, `${obras.length} frentes na semana`)}${k('Custo de MO previsto', brl(custoPrev), semCusto.length ? `sem custo/dia: ${semCusto.map(esc).join(', ')}` : 'todos com custo/dia')}${k('Aderência (RDO × plano)', prev ? Math.round(feito / prev * 100) + '%' : '—', `${feito} de ${prev} dias previstos já com RDO`)}${k('Conflitos / alertas', conflitos.length + alertas.length, 'pessoa em duas obras, feriado, sem atividade')}</div>
  <div class="card tw" style="margin-bottom:14px"><table class="swt"><tr><th>Obra</th>${dias.map(d => `<th>${DOW[dowIdx(d)]} ${fdate(d).slice(0, 5)}${S.feriados[d] ? ' <span class="pill r">feriado</span>' : ''}</th>`).join('')}</tr>${grade || '<tr><td colspan="7">Nenhuma programação nesta semana.</td></tr>'}</table></div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr;margin-bottom:14px">${lista('Conflitos e alertas', conflitos.concat(alertas), 'Nada conflitante na programação.')}${lista('Mudanças da agenda do dia sobre a semanal', mudancas, 'Sem mudanças.')}</div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr">${lista('Pendências da programação (dependências)', pend.map(p => `<b>${esc(short(p.o.nome))}</b> ${fdate(p.d)}: ${esc(p.t.length > 140 ? p.t.slice(0, 138) + '…' : p.t)}`), 'Nenhuma dependência listada.')}${lista('Frentes que liberam gente / sem RDO', liberam.concat(faltaRdo.map(x => 'Sem RDO: ' + x)), 'Nada a destacar.')}</div>`;
}
EXT.click.push(async e => { const t = e.target.closest('[data-swk]'); if (!t) return false; const n = +t.dataset.swk; tab.sw = n === 0 ? mondayOf(today()) : addDays(swSemana(), n); render(); return true; });
